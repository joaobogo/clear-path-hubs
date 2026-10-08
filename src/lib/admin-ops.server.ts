// Admin operations reads: work queues, payments/pilot panel, review queue.
// Server-only. Every query reads real records — nothing is simulated.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Any;
}

export async function requireStaff(userId: string) {
  const s = await admin();
  const { data } = await s.rpc("is_platform_staff", { _user: userId });
  if (data !== true) throw new Error("forbidden");
}

export type {
  QueueTarget,
  QueueOwner,
  QueueClaim,
  QueueItem,
  QueueSeeAll,
  WorkQueue,
} from "./admin-ops-types";
import type { QueueClaim, QueueItem, QueueOwner, QueueRef, WorkQueue } from "./admin-ops-types";
import { INTAKE_AGING_TIER_DAYS } from "@/lib/intake-aging";
import { PAID_PAYMENT_STATES } from "@/lib/publish-gate";
import { deliveryReason } from "./notifications/delivery-reasons";
import { qualifiesAsHire } from "./offer-hire";
import { publishedRunEmbed, publishedScoreDisplay, hasVideoIntro, withVideoIntroBonus, scoreVoidedByUnreadableCv } from "@/lib/scoring/published-score";

/** Approved run wins over current so admin and client read one number; the Loom bonus folds in here. */
const pubRun = (m: { approved_run?: unknown; current_run?: unknown; intro_video_url?: unknown }) =>
  withVideoIntroBonus(
    (m.approved_run ?? m.current_run ?? null) as Parameters<typeof publishedScoreDisplay>[0],
    hasVideoIntro(m),
  );


const ISO = (ms: number) => new Date(Date.now() - ms).toISOString();
const HOUR = 3_600_000;
// How many scored matches the staleness scan reads before it stops. The rule
// cannot be expressed in SQL (it compares two engine versions and the position
// status), so it runs in JS over this window and reports saturation.
const STALE_SCAN_LIMIT = 500;
const PREVIEW_LIMIT = 8;
const DAY = 24 * HOUR;

function ageTone(iso: string | null, warnDays: number, dangerDays: number): QueueItem["tone"] {
  if (!iso) return "default";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "default";
  const days = (Date.now() - date.getTime()) / DAY;
  if (days >= dangerDays) return "danger";
  if (days >= warnDays) return "warning";
  return "default";
}

/** The operator queues, each with an exact count and one direct action. */
export async function loadWorkQueues(raw: { includeTest?: boolean } = {}): Promise<WorkQueue[]> {
  const opts = raw || {};
  const s = await admin();
  const { loadTestScope, excludeTestOrgs } = await import(
    "./admin-test-scope.server"
  );
  const { loadIntakeAging } = await import("./admin-intake-aging.server");
  const scope = await loadTestScope(s, opts.includeTest ?? false);

  // Both decision queues below read the same backlog. Load it once.
  const decisionBacklog = (async () => {
    const { loadDecisionBacklog } = await import("./admin-decision-backlog.server");
    return loadDecisionBacklog(s, { includeTest: opts.includeTest ?? false });
  })();

  const [unpaid, setup, review, readyForDecision, delivered, blocked, agingIntakes, stale] = await Promise.all([
    // 1 — submitted roles that have not been paid for (or are stuck mid-checkout).
    excludeTestOrgs(
      s
        .from("positions")
        .select("id,title,status,payment_status,owner_user_id,created_at,updated_at,organization_id,organizations(id,name)", {
          count: "exact",
        })
        .in("payment_status", ["unpaid", "pending"])
        .not("status", "in", "(draft,archived,closed,filled)")
        .order("updated_at", { ascending: true })
        .limit(8),
      scope,
    ),

    // 2 — paid, exempt or plan-covered roles still waiting on platform setup.
    excludeTestOrgs(
      s
        .from("positions")
        .select("id,title,status,payment_status,owner_user_id,created_at,organization_id,organizations(id,name)", { count: "exact" })
        .in("status", ["submitted", "needs_clarification"])
        .in("payment_status", [...PAID_PAYMENT_STATES])
        .order("created_at", { ascending: true })

        .limit(PREVIEW_LIMIT),
      scope,
    ),

    // 3 — candidates awaiting decision (scored).
    // Scoping must exactly match loadReviewQueueIds for counter agreement.
    excludeTestOrgs(
      s
        .from("candidate_matches")
        .select(
          `id,updated_at,processing_state,intro_video_url,candidate_profiles(full_name),positions(id,title,owner_user_id,organizations(id,name)),${publishedRunEmbed()}`,
          { count: "exact" },
        )
        .eq("admin_status", "pending")
        .eq("processing_state", "scored")
        .order("updated_at", { ascending: true })
        .limit(8),
      scope,
    ),

    // 3.5 — ready for client decision (admin already approved).
    // Derived from matches in delivered+ status with no client decision row.
    // Shares one backlog read with queue 4 below: these were two identical
    // round trips on every load of the busiest admin desk.
    decisionBacklog.then((backlog) => ({ data: [], count: backlog.rows.length })),

    // 4 — shared with the client, no decision recorded yet.
    // The work-queue "Client decisions overdue" tile uses this.
    // We slice to 8 for the preview list but the count reflects the whole backlog.
    decisionBacklog.then((backlog) => ({
      data: backlog.rows,
      count: backlog.rows.length,
    })),



    // 6 — delivery failures a retry can actually clear.
    // The window and the retryable/blocked split are decided once, inside
    // loadDeliveryFailures. Nothing is re-filtered here: local re-filtering is
    // exactly what made this tile disagree with /admin/operations.
    (async () => {
      const { loadDeliveryFailures } = await import("./notification-failures.server");
      const failures = await loadDeliveryFailures(s);
      const retryable = failures.items.filter((f) => f.retryable);

      // One broken integration is ONE item of work, not 150.
      //
      // 150 of the 187 items on this desk were the same internal Teams webhook
      // failing, the same candidate appearing more than once, and every
      // genuine item — 1 approval, 8 decisions, 7 overdue clients, 3
      // interviews — numerically drowned by it. The tile's own description
      // promises failures "where a retry can still get through", and retrying
      // a webhook 150 times will not fix a webhook (audit 1 Sep, F10/F28).
      //
      // loadDeliveryFailures already groups these: summary.systemicFailures is
      // one entry per (channel, reason) with 5+ rows in the window. The desk
      // simply was not reading it, while /admin/notifications was.
      const systemic = failures.summary.systemicFailures ?? [];
      const isSystemic = (f: Any) =>
        systemic.some(
          (g: Any) => g.channel === f.channel && g.reason === f.reason,
        );
      const individual = retryable.filter((f) => !isSystemic(f));

      // One synthetic row per systemic group, carrying its occurrence count,
      // so the cause is named once and stays actionable.
      const grouped = systemic.map((g: Any) => {
        const rows = retryable.filter(
          (f) => f.channel === g.channel && f.reason === g.reason,
        );
        const newest = rows.reduce(
          (acc: string | null, f: Any) =>
            !acc || String(f.lastAttemptAt) > acc ? String(f.lastAttemptAt) : acc,
          null as string | null,
        );
        return {
          id: `systemic:${g.channel}:${g.reason}`,
          title: `${g.channel} — ${rows[0]?.reasonLabel ?? g.reason}`,
          reasonSentence: `${rows.length} deliveries failed the same way. This is one integration to fix, not ${rows.length} retries.`,
          audience: rows[0]?.audience ?? null,
          lastAttemptAt: newest,
          systemic: true,
          occurrences: rows.length,
        };
      });

      return {
        // Grouped causes first: they are the largest single piece of work.
        data: [...grouped, ...individual],
        // The headline counts WORK, not rows.
        count: grouped.length + individual.length,
        rawRows: failures.summary.retryable,
        systemicGroups: grouped.length,
        blockedAddresses: failures.summary.blockedAddresses.length,
        blockedDeliveries: failures.summary.blockedNotSent,
      };
    })(),



    // 7 — real client briefs sitting in the inbox for more than three days.
    loadIntakeAging(s, { includeTest: opts.includeTest ?? false }),
    // 7 — P-006: candidates with stale scores. One definition everywhere: the
    // stored flag set by invalidation triggers OR a run produced by an older
    // engine than the one running today — the same test the per-candidate
    // "Stale" badge applies (see freshnessFromRow), so a badge can never show
    // while this tile reads 0. The engine half must be computed here: the
    // stored flag only covers trigger-recorded invalidations, and after an
    // engine upgrade every list row wore a stale chip while this tile — which
    // once queried only the flag — still read 0.
    (async () => {
      const { data, error } = await excludeTestOrgs(
        s
          .from("candidate_matches")
          .select(
            "id,score_stale,score_stale_at,score_stale_reasons,processing_state,current_score_run_id,approved_score_run_id,approved_run:score_runs!candidate_matches_approved_score_run_id_fkey(engine_version),score_runs!candidate_matches_current_score_run_id_fkey(engine_version),candidate_profiles(full_name),positions(id,title,status,owner_user_id,organizations(id,name))",
          )
          .not("current_score_run_id", "is", null)
          .order("score_stale_at", { ascending: true, nullsFirst: false })
          .limit(STALE_SCAN_LIMIT),
        scope,
      );
      // A failed read used to render as "Stale scores 0" — the one wrong
      // answer that reads as GOOD news, so nobody would ever investigate it.
      // Report it as uncountable instead.
      if (error) return { data: [], count: 0, failed: true, saturated: false };
      const { ENGINE_VERSION } = await import("@/lib/scoring/engine-version");
      const ARCHIVED = new Set(["archived", "closed"]);
      const rows = ((data ?? []) as Any[]).filter((m) => {
        // A role nobody is hiring for cannot have a stale deliverable, and its
        // Recompute can only fail (audit #4, M1/M10).
        if (ARCHIVED.has(String(m.positions?.status ?? ""))) return false;
        // Nor can a score that does not exist be "assessed with an older
        // engine version". A candidate whose CV could not be read was listed
        // as Stale with a Recompute action that cannot succeed — the document
        // has to be OCR d first, and Unreadable docs is the queue that offers
        // that (audit 1 Sep, F9). Same guard the resolver uses, so membership
        // and the score itself answer to one rule.
        if (scoreVoidedByUnreadableCv(m)) return false;
        // Same rule the LIST CHIP applies: the run the client sees (approved)
        // or the current run was produced by an older engine. The tile read 7
        // while 22 rows wore a chip because it only checked the current run
        // (audit #4, M1).
        const currentEngine = String(m.score_runs?.engine_version ?? "");
        const approvedEngine = String(m.approved_run?.engine_version ?? "");
        const engineStale =
          currentEngine !== ENGINE_VERSION ||
          (m.approved_score_run_id ? approvedEngine !== ENGINE_VERSION : false);
        return m.score_stale === true || engineStale;
      });
      // The staleness rule needs both engine versions and the position status,
      // so it is applied in JS over a bounded scan rather than in SQL. That
      // makes the count a floor once the scan saturates: past STALE_SCAN_LIMIT
      // matches the tile would silently undercount with nothing on screen
      // saying so. Say so.
      const saturated = (data ?? []).length >= STALE_SCAN_LIMIT;
      return { data: rows.slice(0, PREVIEW_LIMIT), count: rows.length, failed: false, saturated };
    })(),
  ]);


  /**
   * A read that failed is not a queue that is empty.
   *
   * Every one of these panels derived its count from `res.count ?? 0` with no
   * check on `res.error`, so a failed query rendered as "0" — the single
   * wrong answer that reads as GOOD news, which is why nobody would ever go
   * looking for it. The count still shows 0 because there is nothing truthful
   * to put there, but the badge says the number cannot be trusted.
   */
  const failedBadge = (res: { error?: unknown } | null | undefined) =>
    res && (res as { error?: unknown }).error
      ? { label: "Could not be counted", tone: "danger" as const }
      : null;

  const overdue = (delivered.data ?? []) as any[];

  // Unanswered client messages. A client writing to their recruiter reached the
  // notification bell and nothing else: the work queues covered approvals,
  // intakes, payment, setup, review, decisions, delivery, stale
  // scores and hires, and had no entry for someone waiting on a reply. So a
  // message sat unanswered while the dashboard showed a clear desk.
  //
  // "Unanswered" = an unread message whose sender is not staff. Staff ids are
  // resolved once; a message from the team is a reply, not a request.
  const [staffRows, unreadMsgs] = await Promise.all([
    s.from("memberships").select("user_id").eq("status", "active").in("role", ["platform_admin", "operations"]),
    s
      .from("messages")
      .select(
        "id, body, created_at, sender_user_id, conversation_id, conversations(id, subject, organization_id, position_id, candidate_match_id, organizations(id, name), positions(id, title, owner_user_id))",
        { count: "exact" },
      )
      .is("read_at", null)
      .order("created_at", { ascending: true })
      .limit(50),
  ]);

  const staffIds = new Set(((staffRows.data ?? []) as any[]).map((r) => String(r.user_id)));
  const clientMessages = ((unreadMsgs.data ?? []) as any[])
    .filter((m) => m.sender_user_id && !staffIds.has(String(m.sender_user_id)))
    // A conversation is one item however many messages are waiting in it.
    .filter((m, i, all) => all.findIndex((o) => o.conversation_id === m.conversation_id) === i);


  // 11. Reconciliation: Identify hired candidates to ensure rollup agreement.
  const { countConfirmedHiresPlatformWide } = await import(
    "@/lib/kpis/confirmed-hires.server"
  );
  const hiredCount = await countConfirmedHiresPlatformWide(s);



  // One profile read for every owner id on the page, so each row can show who
  // holds it without a second click.
  const ownerIds = new Set<string>();
  const addOwner = (v: unknown) => {
    if (typeof v === "string" && v) ownerIds.add(v);
  };
  for (const p of (unpaid.data ?? []) as Any[]) addOwner(p.owner_user_id);
  for (const p of (setup.data ?? []) as Any[]) addOwner(p.owner_user_id);
  for (const m of (review.data ?? []) as Any[]) addOwner(m.positions?.owner_user_id);
  for (const m of overdue) addOwner(m.owner_user_id);
  for (const i of agingIntakes.rows) addOwner(i.owner_user_id);
  for (const m of (stale.data ?? []) as Any[]) addOwner(m.positions?.owner_user_id);


  const ownerName = new Map<string, string>();
  if (ownerIds.size) {
    const { data: profiles } = await s
      .from("profiles")
      .select("auth_user_id,full_name,email")
      .in("auth_user_id", [...ownerIds]);
    for (const pr of (profiles ?? []) as Any[]) {
      ownerName.set(pr.auth_user_id, pr.full_name || pr.email || "Unknown staff");
    }
  }
  // An owner id with no profile row is a stale pointer (deleted account, old
  // seed). Showing "Unknown staff" would both assert a person who does not
  // exist and hide the Claim action, leaving the row unassignable — so an
  // unresolvable owner reads as unassigned and stays claimable.
  const owner = (id: unknown): QueueOwner =>
    typeof id === "string" && id && ownerName.has(id)
      ? { user_id: id, name: ownerName.get(id)! }
      : null;

  const positionClaim = (id: unknown): QueueClaim =>
    typeof id === "string" && id ? { kind: "position" as const, id } : null;

  // Linkable refs for the row title/subtitle. An id we do not have degrades to
  // plain text rather than rendering a dead link.
  const posRef = (id: unknown, label: unknown): QueueRef =>
    typeof id === "string" && id
      ? { kind: "position", id, label: String(label ?? "Role") }
      : { kind: "text", label: String(label ?? "—") };
  const orgRef = (id: unknown, label: unknown): QueueRef =>
    typeof id === "string" && id
      ? { kind: "organization", id, label: String(label ?? "Client") }
      : { kind: "text", label: String(label ?? "—") };

  const queues: WorkQueue[] = [
    {
      key: "approvals",
      label: "Approvals",
      description: "Pending client-visible actions: candidate shares, contact releases, or new roles.",
      count: 0, // Will be backfilled by annotateWithApprovals
      action_hint: "Approve to notify the client, or decline with a reason.",
      items: [],
    },
    {
      key: "intakes_aging",
      label: "Intakes awaiting action",
      description: "Client briefs awaiting conversion to positions.",
      count: agingIntakes.counts.open,
      action_hint: "Open the brief: convert it to a role, ask for clarification, or reject it.",
      see_all: { to: "/admin/intake" },
      secondary_badge: agingIntakes.counts.late > 0 ? {
        label: `${agingIntakes.counts.late} over ${INTAKE_AGING_TIER_DAYS.late}d`,
        tone: "warning",
      } : undefined,
      items: agingIntakes.rows.slice(0, PREVIEW_LIMIT).map((i: any) => ({
        id: i.id,
        title: i.company_name ?? i.organization_name ?? "Unnamed company",
        title_ref: { kind: "text", label: i.company_name ?? i.organization_name ?? "Unnamed company" },
        subtitle: i.role_title ?? "No role title",
        subtitle_refs: i.organization_id ? [orgRef(i.organization_id, i.organization_name)] : null,
        meta: i.blocking_reason ?? "Ready to convert",
        waiting_since: i.submitted_at,
        target: { kind: "intake" as const, id: i.id },
        action_label: "Open intake",
        owner: owner(i.owner_user_id),
        claim: null,
        tone: i.tier === "critical" ? "danger" : i.tier === "late" ? "warning" : "default",
      })),
    },

    {
      key: "unpaid",
      label: "Unpaid submissions",
      description: "Roles submitted but not paid for. Nothing publishes until this clears.",
      count: unpaid.count ?? 0,
      secondary_badge: failedBadge(unpaid),
      action_hint: "Open the role to chase payment or grant an exemption.",
      see_all: { to: "/admin/payments" },
      items: ((unpaid.data ?? []) as Any[]).slice(0, PREVIEW_LIMIT).map((p) => ({
        id: p.id,
        title: p.title,
        title_ref: posRef(p.id, p.title),
        subtitle: p.organizations?.name ?? "—",
        subtitle_refs: [orgRef(p.organization_id ?? p.organizations?.id, p.organizations?.name)],
        meta: p.payment_status === "pending" ? "checkout started" : "no checkout yet",
        waiting_since: p.updated_at ?? p.created_at,
        target: { kind: "position" as const, id: p.id },
        action_label: "Resolve payment",
        owner: owner(p.owner_user_id),
        claim: positionClaim(p.id),
        tone: ageTone(p.updated_at ?? p.created_at, 2, 5),
      })),
    },
    {
      key: "setup",
      label: "Roles awaiting setup",
      description: "Paid or exempt roles that still need approval and configuration.",
      count: setup.count ?? 0,
      secondary_badge: failedBadge(setup),
      action_hint: "Open the role, complete setup, approve it.",
      see_all: { to: "/admin/publish" },
      items: ((setup.data ?? []) as any[]).map((p) => ({
        id: p.id,
        title: p.title,
        title_ref: posRef(p.id, p.title),
        subtitle: p.organizations?.name ?? "—",
        
        subtitle_refs: [orgRef(p.organization_id ?? p.organizations?.id, p.organizations?.name)],
        meta: String(p.status).replace(/_/g, " "),
        waiting_since: p.created_at,
        target: { kind: "position" as const, id: p.id },
        action_label: "Set up role",
        owner: owner(p.owner_user_id),
        claim: positionClaim(p.id),
        tone: ageTone(p.created_at, 1, 3),
      })),
    },
    {
      key: "review",
      label: "Candidates awaiting decision",
      description: "Scored candidates awaiting an admin approve, hold, or reject decision.",
      count: review.count ?? 0,
      action_hint: "Review evidence and recorded fit labels to make a decision.",
      see_all: { to: "/admin/candidates" },
      // A failed read outranks the ready-for-decision split: reporting
      // "3 ready for decision" beside a count that could not be computed
      // states a confident fact about numbers we do not have.
      secondary_badge: failedBadge(review) ?? {
        label: `${readyForDecision.count ?? 0} ready for decision`,
        tone: (readyForDecision.count ?? 0) > 0 ? "default" : "neutral",
      },
      items: ((review.data ?? []) as Any[]).slice(0, PREVIEW_LIMIT).map((m) => ({
        id: m.id,
        title: m.candidate_profiles?.full_name ?? "Candidate",
        // No title_ref: the renderer prefers it over title, and these rows' title
        // is the CANDIDATE — the position is already the clickable subtitle.
        subtitle: `${m.positions?.title ?? "—"} · ${m.positions?.organizations?.name ?? "—"}`,
        subtitle_refs: [
          posRef(m.positions?.id, m.positions?.title),
          orgRef(m.positions?.organizations?.id, m.positions?.organizations?.name),
        ],
        // pubRun returns the RUN, which has no processing_state, so the
        // resolver cannot void it here — the match does (audit #8, TF8-01).
        meta: scoreVoidedByUnreadableCv(m) || publishedScoreDisplay(pubRun(m)) == null
          ? null
          : `score ${publishedScoreDisplay(pubRun(m))}`,
        waiting_since: m.updated_at,
        target: { kind: "review" as const, matchId: m.id },
        action_label: "Review",
        owner: owner(m.positions?.owner_user_id),
        claim: positionClaim(m.positions?.id),
        tone: ageTone(m.updated_at, 1, 3),
      })),
    },

    {
      key: "client_overdue",
      label: "Client decisions overdue",
      description: "Shared with the client, still no decision recorded.",
      count: delivered.count ?? 0,
      action_hint: "Nudge the client or call it — the candidate is waiting.",
      see_all: { to: "/admin/decision-backlog" },
      items: overdue.slice(0, 8).map((m) => ({
        id: m.match_id,
        title: m.candidate_name ?? "Candidate",
        // No title_ref — candidate name renders; position is in the subtitle.
        subtitle: `${m.position_title ?? "—"} · ${m.client_name ?? "—"}`,
        
        subtitle_refs: [
          posRef(m.position_id, m.position_title),
          orgRef(m.organization_id, m.client_name),
        ],
        meta: String(m.stage).replace(/_/g, " "),
        waiting_since: m.submitted_at,
        target: { kind: "match" as const, id: m.match_id },
        action_label: "Chase decision",
        owner: owner(m.owner_user_id),
        claim: positionClaim(m.position_id),
        tone: ageTone(m.submitted_at, 5, 8),
      })),
    },

    {
      key: "delivery_failures",
      label: "Delivery failures to retry (7d)",
      description:
        "Email or message failures in the last 7 days where a retry can still get through.",
      count: blocked.count ?? 0,
      action_hint: "Retry the delivery or update the recipient's email.",
      see_all: { to: "/admin/notifications" },
      // A systemic group is the biggest thing on this desk when it exists, so
      // it outranks the blocked-address note: 150 rows collapsing to one cause
      // is the fact a reader needs first (audit 1 Sep, F10).
      secondary_badge:
        ((blocked as Any).systemicGroups ?? 0) > 0
          ? {
              label: `${(blocked as Any).rawRows} deliveries, ${
                (blocked as Any).systemicGroups
              } shared cause${(blocked as Any).systemicGroups === 1 ? "" : "s"}`,
              tone: "danger" as const,
            }
          : ((blocked as Any).blockedAddresses ?? 0) > 0
            ? {
                label: `${(blocked as Any).blockedAddresses} blocked address${
                  (blocked as Any).blockedAddresses === 1 ? "" : "es"
                } — retry won't help`,
                tone: "warning" as const,
              }
            : undefined,
      items: ((blocked.data ?? []) as any[]).slice(0, PREVIEW_LIMIT).map((d) => ({
        id: d.id,
        title: d.title ?? "Delivery failure",
        subtitle: d.reasonSentence ?? deliveryReason(d.reason, d.status).sentence,

        meta: d.audience ?? null,
        waiting_since: d.lastAttemptAt,
        target: { kind: "match" as const, id: d.id },
        action_label: "Fix",
        owner: null,
        claim: null,
        tone: "danger" as const,
      })),
    },
    {
      key: "score_stale",
      label: "Stale scores",
      description: "Candidates whose score inputs changed after assessment.",
      count: stale.count ?? 0,
      secondary_badge: stale.failed
        ? { label: "Could not be counted", tone: "danger" as const }
        : stale.saturated
          ? { label: `at least ${stale.count}`, tone: "warning" as const }
          : null,
      action_hint: "Recompute scores to clear out-of-date banners.",
      see_all: { to: "/admin/scoring/review" as any },
      items: ((stale.data ?? []) as any[]).slice(0, PREVIEW_LIMIT).map((m) => ({
        id: m.id,
        title: m.candidate_profiles?.full_name ?? "Candidate",
        // No title_ref: the renderer prefers it over title, and these rows' title
        // is the CANDIDATE — the position is already the clickable subtitle.
        subtitle: `${m.positions?.title ?? "—"} · ${m.positions?.organizations?.name ?? "—"}`,
        
        subtitle_refs: [
          posRef(m.positions?.id, m.positions?.title),
          orgRef(m.positions?.organizations?.id, m.positions?.organizations?.name),
        ],
        meta:
          Array.isArray(m.score_stale_reasons) && m.score_stale_reasons.length > 0
            ? m.score_stale_reasons.join(", ")
            : m.score_stale
              ? "Inputs changed"
              : "Assessed with an older engine version",
        waiting_since: m.score_stale_at,
        key: "score_stale",
        target: { kind: "review" as const, matchId: m.id },
        action_label: "Recompute",
        owner: owner(m.positions?.owner_user_id),
        claim: positionClaim(m.positions?.id),
        tone: "warning" as const,
      })),
    },
    {
      key: "client_messages",
      label: "Client messages to answer",
      description: "A client wrote and nobody on the team has replied yet.",
      count: clientMessages.length,
      // A bare count reads the same on day one and on day fifteen: a client
      // question sat unanswered for 15 days behind a tile that said "1"
      // (audit TF-A-039). How long the oldest one has waited is what decides
      // whether this queue is fine or embarrassing, so it rides in the badge —
      // the same way intake aging, interviews and stale scores surface theirs.
      // `unreadMsgs` is ordered created_at ascending and the per-conversation
      // dedupe keeps the first row, so clientMessages[0] IS the oldest
      // unanswered message. No additional query.
      secondary_badge: (() => {
        const oldest = clientMessages[0]?.created_at as string | undefined;
        if (!oldest) return null;
        const ms = Date.now() - new Date(oldest).getTime();
        // An unreadable timestamp is not "fresh" — say nothing rather than
        // print a reassuring figure we cannot stand behind.
        if (!Number.isFinite(ms)) return null;
        const days = Math.floor(ms / DAY);
        return {
          label: days >= 1 ? `oldest waiting ${days}d` : "oldest waiting under a day",
          tone: ageTone(oldest, 1, 2),
        };
      })(),
      action_hint: "Open the thread and reply — they are waiting on us.",
      see_all: { to: "/admin/messages" },
      items: clientMessages.slice(0, 8).map((m) => ({
        id: String(m.id),
        title: String(m.conversations?.subject ?? "Message"),
        subtitle: `${m.conversations?.positions?.title ?? "—"} · ${m.conversations?.organizations?.name ?? "—"}`,
        subtitle_refs: [
          posRef(m.conversations?.positions?.id, m.conversations?.positions?.title),
          orgRef(m.conversations?.organization_id, m.conversations?.organizations?.name),
        ],
        meta: String(m.body ?? "").slice(0, 80),
        waiting_since: m.created_at,
        target: { kind: "conversation" as const, id: String(m.conversation_id) },
        action_label: "Reply",
        owner: owner(m.conversations?.positions?.owner_user_id),
        claim: positionClaim(m.conversations?.positions?.id),
        tone: ageTone(m.created_at, 1, 2),
      })),
    },

    {
      key: "hires_pending",
      // No "(Total)": the count follows the page's scope filter like every
      // other card, so under ?scope=mine the old label promised a portfolio
      // figure while showing a personal one (audit A-09).
      label: "Hires confirmed",
      description: "Candidates currently in the 'hired' stage in this view.",
      count: hiredCount,
      action_hint: "View confirmed hires and start dates.",
      see_all: { to: "/admin/candidates" },
      items: [], // Summary tile only
    },
  ];

  const withSla = await annotateWithSlaBreaches(queues, opts.includeTest ?? false);
  return annotateWithApprovals(withSla, opts.includeTest ?? false);
}

/**
 * Overlay the approvals inbox onto the Work Queue.
 */
async function annotateWithApprovals(
  queues: WorkQueue[],
  includeTest: boolean,
): Promise<WorkQueue[]> {
  const s = await admin();
  const { loadApprovals } = await import("./admin-approvals.server");
  
  const inbox = await loadApprovals(s, { includeTest });
  const allItems = (inbox.groups ?? []).flatMap((g) => g.items);
  
  return queues.map((q) => {
    if (q.key !== "approvals") return q;
    
    return {
      ...q,
      count: inbox.total,
      items: allItems.slice(0, 8).map((it) => ({
        id: it.id,
        title: it.target_label,
        subtitle: `${it.context_label}${it.org_name ? ` · ${it.org_name}` : ""}`,
        subtitle_refs: [],
        meta: it.requester_name,
        waiting_since: it.requested_at,
        target: {
          kind: "approval" as const,
          id: it.id,
          target_id: it.target_id,
          target_kind: it.target_type,
        },
        action_label: "Review",
        owner: null,
        claim: null,
        tone: "default" as const,
      })),
    };
  }).filter(q => q.key !== 'approvals' || (q.count ?? 0) > 0);
}

/**
 * Overlay live commitment breaches onto the queues so the worst promise is the
 * first thing an operator sees. Severity = whole days past the moment the
 * commitment was first missed; acknowledged breaches stop escalating.
 */
async function annotateWithSlaBreaches(
  queues: WorkQueue[],
  includeTest: boolean,
): Promise<WorkQueue[]> {
  const s = await admin();
  const { loadSlaBreaches } = await import("./admin-sla-breach.server");
  let worstByPosition = new Map<string, { metric_label: string; days_over: number }>();
  try {
    const list = await loadSlaBreaches(s, { includeTest });
    for (const r of (list?.rows ?? [])) {
      if (!r || r.acknowledged) continue;
      const posId = r.position_id;
      if (!posId) continue;
      const current = worstByPosition.get(posId);
      if (!current || r.days_over > current.days_over) {
        worstByPosition.set(posId, {
          metric_label: r.metric_label || "SLA",
          days_over: r.days_over || 0,
        });
      }
    }
  } catch {
    // A breach read failure must not blank the queues; rows simply render
    // without the escalation badge.
    worstByPosition = new Map();
  }
  if (worstByPosition.size === 0) return queues;

  return queues.map((q) => {
    const items = q.items.map((it) => {
      const positionId = it.claim?.kind === "position" ? it.claim.id : null;
      const breach = positionId ? (worstByPosition.get(positionId) ?? null) : null;
      return breach
        ? { ...it, sla_breach: breach, tone: "danger" as const }
        : { ...it, sla_breach: null };
    });
    items.sort((a, b) => {
      const ad = a.sla_breach?.days_over ?? -1;
      const bd = b.sla_breach?.days_over ?? -1;
      if (ad !== bd) return bd - ad;
      const at = a.waiting_since ? new Date(a.waiting_since).getTime() : Infinity;
      const bt = b.waiting_since ? new Date(b.waiting_since).getTime() : Infinity;
      return at - bt;
    });
    return { ...q, items };
  });
}


export type PaymentsOpsPanel = {
  paid: Array<{
    id: string;
    org: string | null;
    position: string | null;
    positionId: string | null;
    amount_cents: number;
    currency: string;
    paid_at: string | null;
    reference: string | null;
    environment: string;
  }>;
  abandoned: Array<{
    positionId: string;
    title: string;
    org: string | null;
    orgId: string;
    started_at: string | null;
    stage: "checkout_started" | "never_started";
  }>;
  pilots: Array<{
    orgId: string;
    org: string;
    status: string | null;
    started_at: string | null;
    ends_at: string | null;
    completed_at: string | null;
    days_left: number | null;
    override: boolean;
    position_title: string | null;
  }>;
  totals: { paid_cents_by_currency: Record<string, number>; paid_count: number };
};

/** Money and pilot state, from records only — no estimates, no placeholders. */
export async function loadPaymentsOpsPanel(userId: string): Promise<PaymentsOpsPanel> {
  const s = await admin();
  const { resolveShowTestRecordsForUser, loadTestScope, excludeTestOrgs, excludeTestPositions, excludeTestFlag } =
    await import("./admin-test-scope.server");
  const showTest = await resolveShowTestRecordsForUser(s, userId);
  const scope = await loadTestScope(s, showTest);

  const [paidRes, abandonedRes, pilotRes] = await Promise.all([
    excludeTestOrgs(
      s
        .from("payments")
        .select(
          "id,amount_cents,currency,paid_at,created_at,provider_reference,provider_environment,organizations(name),positions(id,title)",
        )
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(50),
      scope,
    ),
    excludeTestOrgs(
      s
        .from("positions")
        .select("id,title,organization_id,payment_status,created_at,updated_at,organizations(name)")
        .in("payment_status", ["unpaid", "pending"])
        .not("status", "in", "(draft,archived,closed,filled)")
        .order("updated_at", { ascending: false })
        .limit(50),
      scope,
    ),
    excludeTestFlag(
      s
        .from("organizations")
        .select(
          "id,name,pilot_status,pilot_started_at,pilot_ends_at,pilot_completed_at,pilot_admin_override,pilot_position_id",
        )
        .not("pilot_status", "is", null)
        .order("pilot_started_at", { ascending: false })
        .limit(50),
    ),
  ]);

  const pilotPositionIds = ((pilotRes.data ?? []) as Any[])
    .map((o) => o.pilot_position_id)
    .filter(Boolean);
  let titles: Record<string, string> = {};
  if (pilotPositionIds.length) {
    const { data } = await excludeTestPositions(
      s.from("positions").select("id,title").in("id", pilotPositionIds),
      scope,
    );
    titles = Object.fromEntries(((data ?? []) as Any[]).map((p) => [p.id, p.title]));
  }

  const paid = ((paidRes.data ?? []) as Any[]).map((p) => ({
    id: p.id,
    org: p.organizations?.name ?? null,
    position: p.positions?.title ?? null,
    positionId: p.positions?.id ?? null,
    amount_cents: p.amount_cents,
    currency: p.currency,
    paid_at: p.paid_at ?? p.created_at,
    reference: p.provider_reference,
    environment: p.provider_environment,
  }));

  const paid_cents_by_currency: Record<string, number> = {};
  for (const p of paid) {
    const c = (p.currency ?? "usd").toUpperCase();
    paid_cents_by_currency[c] = (paid_cents_by_currency[c] ?? 0) + Number(p.amount_cents ?? 0);
  }

  return {
    paid,
    abandoned: ((abandonedRes.data ?? []) as Any[]).map((p) => ({
      positionId: p.id,
      title: p.title,
      org: p.organizations?.name ?? null,
      orgId: p.organization_id,
      started_at: p.updated_at ?? p.created_at,
      stage: p.payment_status === "pending" ? ("checkout_started" as const) : ("never_started" as const),
    })),
    pilots: ((pilotRes.data ?? []) as Any[]).map((o) => ({
      orgId: o.id,
      org: o.name,
      status: o.pilot_status,
      started_at: o.pilot_started_at,
      ends_at: o.pilot_ends_at,
      completed_at: o.pilot_completed_at,
      days_left: o.pilot_ends_at
        ? Math.ceil((new Date(o.pilot_ends_at).getTime() - Date.now()) / DAY)
        : null,
      override: o.pilot_admin_override === true,
      position_title: o.pilot_position_id ? (titles[o.pilot_position_id] ?? null) : null,
    })),
    totals: { paid_cents_by_currency, paid_count: paid.length },
  };
}

/** Ordered ids of everything awaiting decision, so the reviewer never goes back to a list. */
export async function loadReviewQueueIds(opts: { includeTest?: boolean } = {}): Promise<string[]> {
  const s = await admin();
  const { loadTestScope, excludeTestOrgs } = await import("./admin-test-scope.server");
  const scope = await loadTestScope(s, opts.includeTest ?? false);

  const { data } = await excludeTestOrgs(
    s
      .from("candidate_matches")
      .select("id,updated_at")
      .eq("admin_status", "pending")
      .eq("processing_state", "scored")
      .order("updated_at", { ascending: true })
      .limit(200),
    scope,
  );
  return ((data ?? []) as Any[]).map((m) => m.id as string);
}
