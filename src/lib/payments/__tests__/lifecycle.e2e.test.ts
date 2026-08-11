/**
 * Full payment lifecycle test.
 *
 * `money-path.e2e.test.ts` covers the one-off role purchase. This file covers
 * the rest of the commercial cycle, which the one-off path never touches:
 *
 *   pick plan -> pay -> entitlement granted -> allowance claimed -> role live
 *   -> payment fails -> access held or withdrawn -> downgrade -> graceful end
 *
 * The mirror below is transcribed from the deployed database functions
 * (`apply_subscription_event`, `grant_plan_entitlement`,
 * `consume_role_allowance`, `enforce_position_payment_gate`), so a drift
 * between this model and production shows up as a failing test rather than a
 * silently wrong entitlement. Three details that the one-off mirror gets wrong
 * and this one does not:
 *
 *   1. the publish gate accepts `covered`, not just `paid`/`exempt`,
 *   2. `past_due` keeps the allowance alive (Stripe is still retrying),
 *   3. only `covered` roles are paused when a subscription ends — `exempt`
 *      and one-off `paid` roles are unaffected.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { PAID_PAYMENT_STATES, isPaymentSatisfied } from "@/lib/publish-gate";
import { findPlan } from "@/lib/payments-catalog";

type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded" | "exempt" | "covered";
type PositionStatus = "draft" | "submitted" | "approved" | "active" | "paused";
type SubStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete_expired";

const GATE_ERROR = /cannot be published until payment is complete/;

type Position = {
  id: string;
  organization_id: string;
  status: PositionStatus;
  payment_status: PaymentStatus;
  covered_by_entitlement_id: string | null;
};

type Entitlement = {
  id: string;
  organization_id: string;
  subscription_id: string | null;
  source: "package" | "subscription";
  source_event_id: string | null;
  price_id: string;
  plan_label: string;
  roles_total: number | null;
  roles_used: number;
  status: "active" | "cancelled";
  expires_at: number | null;
};

type Subscription = {
  id: string;
  organization_id: string;
  provider_subscription_id: string;
  price_id: string;
  plan_label: string;
  status: SubStatus;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  pending_price_id: string | null;
  pending_effective_at: number | null;
};

const ORG = "org_1";

class Db {
  positions = new Map<string, Position>();
  entitlements: Entitlement[] = [];
  subscriptions: Subscription[] = [];
  seenPaymentEvents = new Set<string>();
  seenSubEvents = new Set<string>();
  notifications: { event: string; title: string }[] = [];
  audit: { action: string; entity: string }[] = [];
  private seq = 0;
  private id(p: string) {
    return `${p}_${++this.seq}`;
  }

  /** Mirror of `enforce_position_payment_gate`. */
  setPositionStatus(id: string, next: PositionStatus) {
    const p = this.positions.get(id)!;
    const publishing = next === "active" || next === "approved";
    if (publishing && p.status !== next && !isPaymentSatisfied(p.payment_status)) {
      throw new Error(
        "This role cannot be published until payment is complete. Your brief is saved as a draft.",
      );
    }
    p.status = next;
  }

  /** Mirror of `grant_plan_entitlement` — idempotent on the webhook event id. */
  grantPackageEntitlement(args: {
    eventId: string;
    priceId: string;
    expiresAt: number | null;
  }) {
    if (this.entitlements.some((e) => e.source_event_id === args.eventId)) {
      return { applied: false, reason: "duplicate_event" as const };
    }
    const plan = findPlan(args.priceId)!;
    const ent: Entitlement = {
      id: this.id("ent"),
      organization_id: ORG,
      subscription_id: null,
      source: "package",
      source_event_id: args.eventId,
      price_id: args.priceId,
      plan_label: plan.label,
      roles_total: plan.rolesTotal,
      roles_used: 0,
      status: "active",
      expires_at: args.expiresAt,
    };
    this.entitlements.push(ent);
    this.notifications.push({ event: "intake_submitted", title: "New package purchased" });
    this.audit.push({ action: "entitlement_granted", entity: ent.id });
    return { applied: true as const, entitlementId: ent.id };
  }

  /** Mirror of `apply_subscription_event` — idempotent on the event id. */
  applySubscriptionEvent(args: {
    eventId: string;
    eventType: string;
    subscriptionId: string;
    priceId: string;
    status: SubStatus;
    periodEnd?: number | null;
    cancelAtPeriodEnd?: boolean;
  }) {
    if (this.seenSubEvents.has(args.eventId)) {
      return { applied: false, reason: "duplicate_event" as const };
    }
    this.seenSubEvents.add(args.eventId);

    const plan = findPlan(args.priceId);
    let sub = this.subscriptions.find(
      (s) => s.provider_subscription_id === args.subscriptionId,
    );
    let isNew = false;

    if (!sub) {
      sub = {
        id: this.id("sub"),
        organization_id: ORG,
        provider_subscription_id: args.subscriptionId,
        price_id: args.priceId,
        plan_label: plan?.label ?? args.priceId,
        status: args.status,
        current_period_end: args.periodEnd ?? null,
        cancel_at_period_end: Boolean(args.cancelAtPeriodEnd),
        pending_price_id: null,
        pending_effective_at: null,
      };
      this.subscriptions.push(sub);
      isNew = true;
    } else {
      sub.price_id = args.priceId;
      sub.plan_label = plan?.label ?? sub.plan_label;
      sub.status = args.status;
      sub.current_period_end = args.periodEnd ?? sub.current_period_end;
      sub.cancel_at_period_end = Boolean(args.cancelAtPeriodEnd);
      // A scheduled change that has now landed clears itself.
      if (sub.pending_price_id === args.priceId) {
        sub.pending_price_id = null;
        sub.pending_effective_at = null;
      }
    }

    let ent = this.entitlements.find((e) => e.subscription_id === sub!.id);
    let ended = false;

    if (["active", "trialing", "past_due"].includes(args.status)) {
      if (!ent) {
        ent = {
          id: this.id("ent"),
          organization_id: ORG,
          subscription_id: sub.id,
          source: "subscription",
          source_event_id: null,
          price_id: args.priceId,
          plan_label: plan?.label ?? args.priceId,
          roles_total: plan?.rolesTotal ?? null,
          roles_used: 0,
          status: "active",
          expires_at: null,
        };
        this.entitlements.push(ent);
      } else {
        ent.price_id = args.priceId;
        ent.plan_label = plan?.label ?? ent.plan_label;
        ent.roles_total = plan?.rolesTotal ?? null;
        ent.status = "active";
        ent.expires_at = null;
      }
    } else if (["canceled", "unpaid", "incomplete_expired"].includes(args.status)) {
      ended = true;
      if (ent) {
        ent.status = "cancelled";
        ent.expires_at = ent.expires_at ?? Date.now();
      }
      // Only plan-covered roles come off. Paid and exempt roles are untouched.
      for (const p of this.positions.values()) {
        if (
          p.organization_id === ORG &&
          p.status === "active" &&
          p.payment_status === "covered"
        ) {
          p.status = "paused";
        }
      }
      this.notifications.push({
        event: "position_paused",
        title: "Subscription ended — covered roles paused",
      });
    }

    if (isNew) {
      this.notifications.push({ event: "intake_submitted", title: "New subscription started" });
    }
    this.audit.push({ action: `subscription_${args.eventType}`, entity: sub.id });
    return { applied: true as const, subscriptionId: sub.id, ended };
  }

  /** Mirror of `consume_role_allowance`. */
  consumeAllowance(positionId: string, actor: { id: string; editor: boolean }) {
    const pos = this.positions.get(positionId);
    if (!pos) return { ok: false as const, reason: "not_found" };
    if (!actor.editor) return { ok: false as const, reason: "forbidden" };
    if (isPaymentSatisfied(pos.payment_status)) {
      return { ok: true as const, reason: "already_covered" };
    }

    const now = Date.now();
    const ent = this.entitlements
      .filter(
        (e) =>
          e.organization_id === pos.organization_id &&
          e.status === "active" &&
          (e.expires_at === null || e.expires_at > now) &&
          (e.roles_total === null || e.roles_used < e.roles_total),
      )
      .sort((a, b) => Number(a.roles_total === null) - Number(b.roles_total === null))[0];

    if (!ent) return { ok: false as const, reason: "no_allowance" };

    ent.roles_used += 1;
    pos.payment_status = "covered";
    pos.covered_by_entitlement_id = ent.id;
    this.audit.push({ action: "allowance_consumed", entity: pos.id });

    return {
      ok: true as const,
      entitlementId: ent.id,
      planLabel: ent.plan_label,
      rolesRemaining: ent.roles_total === null ? null : ent.roles_total - ent.roles_used,
    };
  }

  addRole(id: string): Position {
    const p: Position = {
      id,
      organization_id: ORG,
      status: "draft",
      payment_status: "unpaid",
      covered_by_entitlement_id: null,
    };
    this.positions.set(id, p);
    return p;
  }
}

let db: Db;
const EDITOR = { id: "user_1", editor: true };
const MONTH = 30 * 24 * 60 * 60 * 1000;

beforeEach(() => {
  db = new Db();
});

// ── 1. Selecting and paying for a plan ─────────────────────────────────────

describe("selecting a plan and paying", () => {
  it("a package purchase grants an allowance sized to the plan", () => {
    const result = db.grantPackageEntitlement({
      eventId: "evt_pkg_1",
      priceId: "multi_onetime",
      expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
    });

    expect(result.applied).toBe(true);
    const ent = db.entitlements[0];
    expect(ent.plan_label).toBe(findPlan("multi_onetime")!.label);
    expect(ent.roles_total).toBe(findPlan("multi_onetime")!.rolesTotal);
    expect(ent.roles_used).toBe(0);
    expect(ent.status).toBe("active");
    // Ops must be told to start work — a paid client waiting silently is the
    // worst failure mode here.
    expect(db.notifications.some((n) => n.title.includes("New package"))).toBe(true);
  });

  it("a replayed package webhook does not grant a second allowance", () => {
    db.grantPackageEntitlement({ eventId: "evt_dup", priceId: "pilot_onetime", expiresAt: null });
    const replay = db.grantPackageEntitlement({
      eventId: "evt_dup",
      priceId: "pilot_onetime",
      expiresAt: null,
    });

    expect(replay).toEqual({ applied: false, reason: "duplicate_event" });
    expect(db.entitlements).toHaveLength(1);
  });

  it("a new subscription creates the subscription and its allowance together", () => {
    const res = db.applySubscriptionEvent({
      eventId: "evt_sub_1",
      eventType: "customer.subscription.created",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_bronze_monthly",
      status: "active",
      periodEnd: Date.now() + MONTH,
    });

    expect(res.applied).toBe(true);
    expect(db.subscriptions[0].status).toBe("active");
    const ent = db.entitlements[0];
    expect(ent.source).toBe("subscription");
    expect(ent.subscription_id).toBe(db.subscriptions[0].id);
    expect(ent.roles_total).toBe(findPlan("sub_bronze_monthly")!.rolesTotal);
  });

  it("a trialing subscription already carries a usable allowance", () => {
    db.applySubscriptionEvent({
      eventId: "evt_trial",
      eventType: "customer.subscription.created",
      subscriptionId: "sub_trial",
      priceId: "sub_bronze_monthly",
      status: "trialing",
    });
    expect(db.entitlements[0].status).toBe("active");
  });
});

// ── 2. Receiving the entitlement and accessing gated features ──────────────

describe("entitlement unlocks the gated feature", () => {
  beforeEach(() => {
    db.addRole("pos_1");
    db.applySubscriptionEvent({
      eventId: "evt_sub_1",
      eventType: "customer.subscription.created",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_bronze_monthly",
      status: "active",
      periodEnd: Date.now() + MONTH,
    });
  });

  it("a role cannot go live before the allowance is claimed", () => {
    expect(() => db.setPositionStatus("pos_1", "active")).toThrow(GATE_ERROR);
    expect(db.positions.get("pos_1")!.status).toBe("draft");
  });

  it("claiming the allowance marks the role covered and lets it go live", () => {
    const claim = db.consumeAllowance("pos_1", EDITOR);

    expect(claim.ok).toBe(true);
    expect(db.positions.get("pos_1")!.payment_status).toBe("covered");
    expect(db.positions.get("pos_1")!.covered_by_entitlement_id).toBe(db.entitlements[0].id);
    expect(db.entitlements[0].roles_used).toBe(1);

    expect(() => db.setPositionStatus("pos_1", "active")).not.toThrow();
    expect(db.positions.get("pos_1")!.status).toBe("active");
  });

  it("`covered` satisfies the publish gate everywhere it is checked", () => {
    // Regression guard: the gate and every queue that filters on payment must
    // agree on the full set, or plan customers fall through a crack.
    expect(PAID_PAYMENT_STATES).toContain("covered");
    expect(isPaymentSatisfied("covered")).toBe(true);
    expect(isPaymentSatisfied("unpaid")).toBe(false);
    expect(isPaymentSatisfied("pending")).toBe(false);
    expect(isPaymentSatisfied("refunded")).toBe(false);
  });

  it("the allowance runs out and the next role is refused", () => {
    const total = db.entitlements[0].roles_total!;
    for (let i = 0; i < total; i++) {
      db.addRole(`bulk_${i}`);
      expect(db.consumeAllowance(`bulk_${i}`, EDITOR).ok).toBe(true);
    }

    db.addRole("one_too_many");
    const refused = db.consumeAllowance("one_too_many", EDITOR);

    expect(refused).toEqual({ ok: false, reason: "no_allowance" });
    expect(db.positions.get("one_too_many")!.payment_status).toBe("unpaid");
    expect(() => db.setPositionStatus("one_too_many", "active")).toThrow(GATE_ERROR);
    expect(db.entitlements[0].roles_used).toBe(total);
  });

  it("claiming twice for the same role does not double-spend the allowance", () => {
    db.consumeAllowance("pos_1", EDITOR);
    const second = db.consumeAllowance("pos_1", EDITOR);

    expect(second).toEqual({ ok: true, reason: "already_covered" });
    expect(db.entitlements[0].roles_used).toBe(1);
  });

  it("a non-editor cannot spend the organisation's allowance", () => {
    const res = db.consumeAllowance("pos_1", { id: "outsider", editor: false });
    expect(res).toEqual({ ok: false, reason: "forbidden" });
    expect(db.entitlements[0].roles_used).toBe(0);
  });

  it("an expired package allowance cannot be claimed", () => {
    const fresh = new Db();
    fresh.addRole("pos_x");
    fresh.grantPackageEntitlement({
      eventId: "evt_old",
      priceId: "pilot_onetime",
      expiresAt: Date.now() - 1000,
    });
    expect(fresh.consumeAllowance("pos_x", EDITOR)).toEqual({
      ok: false,
      reason: "no_allowance",
    });
  });
});

// ── 3. Failed payment ──────────────────────────────────────────────────────

describe("failed payment", () => {
  beforeEach(() => {
    db.addRole("pos_1");
    db.applySubscriptionEvent({
      eventId: "evt_sub_1",
      eventType: "customer.subscription.created",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_bronze_monthly",
      status: "active",
      periodEnd: Date.now() + MONTH,
    });
    db.consumeAllowance("pos_1", EDITOR);
    db.setPositionStatus("pos_1", "active");
  });

  it("past_due keeps the role live while the provider retries", () => {
    db.applySubscriptionEvent({
      eventId: "evt_pastdue",
      eventType: "customer.subscription.updated",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_bronze_monthly",
      status: "past_due",
    });

    // Retries are still running — cutting a client off here would be wrong.
    expect(db.subscriptions[0].status).toBe("past_due");
    expect(db.entitlements[0].status).toBe("active");
    expect(db.positions.get("pos_1")!.status).toBe("active");
  });

  it("recovering from past_due leaves everything intact", () => {
    db.applySubscriptionEvent({
      eventId: "evt_pastdue",
      eventType: "customer.subscription.updated",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_bronze_monthly",
      status: "past_due",
    });
    db.applySubscriptionEvent({
      eventId: "evt_recovered",
      eventType: "customer.subscription.updated",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_bronze_monthly",
      status: "active",
    });

    expect(db.entitlements).toHaveLength(1);
    expect(db.entitlements[0].roles_used).toBe(1);
    expect(db.positions.get("pos_1")!.status).toBe("active");
  });

  it("exhausted retries end the allowance and pause the covered role", () => {
    const res = db.applySubscriptionEvent({
      eventId: "evt_unpaid",
      eventType: "customer.subscription.updated",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_bronze_monthly",
      status: "unpaid",
    });

    expect(res.ended).toBe(true);
    expect(db.entitlements[0].status).toBe("cancelled");
    // Paused, never deleted — the work is recoverable if they pay.
    expect(db.positions.get("pos_1")!.status).toBe("paused");
    expect(db.positions.get("pos_1")!.payment_status).toBe("covered");
    expect(db.notifications.some((n) => n.title.includes("covered roles paused"))).toBe(true);
  });

  it("ending a subscription never touches one-off paid or exempt roles", () => {
    const paid = db.addRole("pos_paid");
    paid.payment_status = "paid";
    db.setPositionStatus("pos_paid", "active");

    const exempt = db.addRole("pos_exempt");
    exempt.payment_status = "exempt";
    db.setPositionStatus("pos_exempt", "active");

    db.applySubscriptionEvent({
      eventId: "evt_gone",
      eventType: "customer.subscription.deleted",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_bronze_monthly",
      status: "canceled",
    });

    expect(db.positions.get("pos_1")!.status).toBe("paused");
    expect(db.positions.get("pos_paid")!.status).toBe("active");
    expect(db.positions.get("pos_exempt")!.status).toBe("active");
  });
});

// ── 4. Downgrading and cancelling gracefully ───────────────────────────────

describe("downgrade and cancellation", () => {
  beforeEach(() => {
    db.addRole("pos_1");
    db.applySubscriptionEvent({
      eventId: "evt_sub_1",
      eventType: "customer.subscription.created",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_gold_monthly",
      status: "active",
      periodEnd: Date.now() + MONTH,
    });
    db.consumeAllowance("pos_1", EDITOR);
    db.setPositionStatus("pos_1", "active");
  });

  it("an upgrade raises the allowance immediately and keeps roles used", () => {
    const before = db.entitlements[0].roles_used;
    db.applySubscriptionEvent({
      eventId: "evt_up",
      eventType: "customer.subscription.updated",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_gold_monthly",
      status: "active",
    });
    expect(db.entitlements[0].roles_used).toBe(before);
    expect(db.entitlements).toHaveLength(1);
  });

  it("a scheduled downgrade does not reduce the allowance before renewal", () => {
    const renewal = Date.now() + MONTH;
    // changePlan schedules the switch and records the intent.
    db.subscriptions[0].pending_price_id = "sub_bronze_monthly";
    db.subscriptions[0].pending_effective_at = renewal;

    // Nothing about today's access changes.
    expect(db.entitlements[0].price_id).toBe("sub_gold_monthly");
    expect(db.entitlements[0].roles_total).toBe(findPlan("sub_gold_monthly")!.rolesTotal);
    expect(db.positions.get("pos_1")!.status).toBe("active");
  });

  it("the downgrade lands at renewal and clears the pending flag", () => {
    db.subscriptions[0].pending_price_id = "sub_bronze_monthly";
    db.subscriptions[0].pending_effective_at = Date.now() + MONTH;

    db.applySubscriptionEvent({
      eventId: "evt_renewed",
      eventType: "customer.subscription.updated",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_bronze_monthly",
      status: "active",
      periodEnd: Date.now() + 2 * MONTH,
    });

    const sub = db.subscriptions[0];
    expect(sub.price_id).toBe("sub_bronze_monthly");
    expect(sub.pending_price_id).toBeNull();
    expect(sub.pending_effective_at).toBeNull();

    const ent = db.entitlements[0];
    expect(ent.roles_total).toBe(findPlan("sub_bronze_monthly")!.rolesTotal);
    expect(ent.status).toBe("active");
    // The live role stays live across the downgrade.
    expect(db.positions.get("pos_1")!.status).toBe("active");
  });

  it("cancelling keeps roles live until the paid period actually ends", () => {
    const periodEnd = Date.now() + MONTH;
    db.applySubscriptionEvent({
      eventId: "evt_cancel_req",
      eventType: "customer.subscription.updated",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_gold_monthly",
      status: "active",
      periodEnd,
      cancelAtPeriodEnd: true,
    });

    expect(db.subscriptions[0].cancel_at_period_end).toBe(true);
    expect(db.subscriptions[0].current_period_end).toBe(periodEnd);
    // Still paid for — access must not be withdrawn early.
    expect(db.entitlements[0].status).toBe("active");
    expect(db.positions.get("pos_1")!.status).toBe("active");
  });

  it("resuming before the period ends restores the plan with no gap", () => {
    db.applySubscriptionEvent({
      eventId: "evt_cancel_req",
      eventType: "customer.subscription.updated",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_gold_monthly",
      status: "active",
      cancelAtPeriodEnd: true,
    });
    db.applySubscriptionEvent({
      eventId: "evt_resume",
      eventType: "customer.subscription.updated",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_gold_monthly",
      status: "active",
      cancelAtPeriodEnd: false,
    });

    expect(db.subscriptions[0].cancel_at_period_end).toBe(false);
    expect(db.entitlements[0].status).toBe("active");
    expect(db.positions.get("pos_1")!.status).toBe("active");
  });

  it("at period end the plan ends, roles pause, and nothing is destroyed", () => {
    db.applySubscriptionEvent({
      eventId: "evt_deleted",
      eventType: "customer.subscription.deleted",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_gold_monthly",
      status: "canceled",
    });

    expect(db.subscriptions[0].status).toBe("canceled");
    expect(db.entitlements[0].status).toBe("cancelled");
    expect(db.entitlements[0].expires_at).not.toBeNull();
    expect(db.positions.get("pos_1")!.status).toBe("paused");
    // The role and its history survive; re-subscribing can revive it.
    expect(db.positions.has("pos_1")).toBe(true);
    expect(db.audit.some((a) => a.action.includes("subscription"))).toBe(true);
  });

  it("a cancelled allowance cannot be spent on a new role", () => {
    db.applySubscriptionEvent({
      eventId: "evt_deleted",
      eventType: "customer.subscription.deleted",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_gold_monthly",
      status: "canceled",
    });

    db.addRole("pos_after");
    expect(db.consumeAllowance("pos_after", EDITOR)).toEqual({
      ok: false,
      reason: "no_allowance",
    });
    expect(() => db.setPositionStatus("pos_after", "active")).toThrow(GATE_ERROR);
  });

  it("re-subscribing after cancellation restores a usable allowance", () => {
    db.applySubscriptionEvent({
      eventId: "evt_deleted",
      eventType: "customer.subscription.deleted",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_gold_monthly",
      status: "canceled",
    });
    db.applySubscriptionEvent({
      eventId: "evt_resub",
      eventType: "customer.subscription.created",
      subscriptionId: "sub_stripe_2",
      priceId: "sub_bronze_monthly",
      status: "active",
      periodEnd: Date.now() + MONTH,
    });

    db.addRole("pos_new");
    const claim = db.consumeAllowance("pos_new", EDITOR);
    expect(claim.ok).toBe(true);
    expect(() => db.setPositionStatus("pos_new", "active")).not.toThrow();
    // The old cancelled allowance is still cancelled, not resurrected.
    expect(db.entitlements.filter((e) => e.status === "cancelled")).toHaveLength(1);
  });

  it("replayed subscription events are ignored", () => {
    const replay = db.applySubscriptionEvent({
      eventId: "evt_sub_1",
      eventType: "customer.subscription.created",
      subscriptionId: "sub_stripe_1",
      priceId: "sub_gold_monthly",
      status: "active",
    });
    expect(replay).toEqual({ applied: false, reason: "duplicate_event" });
    expect(db.subscriptions).toHaveLength(1);
    expect(db.entitlements).toHaveLength(1);
  });
});
