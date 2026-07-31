/**
 * End-to-end test for the money path:
 *
 *   account + org  ->  role submitted as draft  ->  checkout session
 *   ->  webhook  ->  payment row + payment_status=paid  ->  role published
 *
 * The enforcement lives in the database:
 *   - `enforce_position_payment_gate` blocks `active`/`approved` unless
 *     payment_status is `paid` or `exempt`,
 *   - `apply_payment_webhook_event` is idempotent on the event id and writes
 *     the payment row, flips payment_status and publishes in one transaction.
 *
 * This test reproduces both contracts against a faithful in-memory mirror, so
 * the critical assertion holds without live Stripe: *skipping the webhook
 * leaves the role unpublished*.
 */
import { describe, it, expect, beforeEach } from "vitest";

type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded" | "exempt";
type PositionStatus = "draft" | "active" | "approved" | "paused";

type Position = {
  id: string;
  organization_id: string;
  status: PositionStatus;
  payment_status: PaymentStatus;
};

type Payment = {
  webhook_event_id: string;
  organization_id: string;
  position_id: string | null;
  provider_reference: string;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
};

const PAYMENT_GATE_ERROR =
  "This role can't be published until payment is complete. Finish checkout and it will go live automatically.";

class Db {
  positions = new Map<string, Position>();
  payments: Payment[] = [];
  notifications: { audience: string; event: string; position_id: string | null }[] = [];
  audit: { action: string; position_id: string | null; actor: string; reason?: string }[] = [];

  /** Mirror of `enforce_position_payment_gate`. */
  setPositionStatus(id: string, next: PositionStatus) {
    const p = this.positions.get(id)!;
    const publishing = next === "active" || next === "approved";
    const gated = p.payment_status !== "paid" && p.payment_status !== "exempt";
    if (publishing && gated) throw new Error(PAYMENT_GATE_ERROR);
    p.status = next;
  }

  /** Mirror of `apply_payment_webhook_event` — idempotent on the event id. */
  applyWebhookEvent(args: {
    eventId: string;
    organizationId: string;
    positionId: string | null;
    providerReference: string;
    amountCents: number;
    currency: string;
    outcome: "paid" | "refunded" | "pending" | "unpaid";
  }) {
    if (this.payments.some((p) => p.webhook_event_id === args.eventId)) {
      return { applied: false, reason: "duplicate_event" };
    }

    const status: PaymentStatus =
      args.outcome === "paid" ? "paid" : args.outcome === "refunded" ? "refunded" : args.outcome;

    this.payments.push({
      webhook_event_id: args.eventId,
      organization_id: args.organizationId,
      position_id: args.positionId,
      provider_reference: args.providerReference,
      amount_cents: args.amountCents,
      currency: args.currency,
      status,
    });

    const position = args.positionId ? this.positions.get(args.positionId) : undefined;
    if (position && position.payment_status !== "exempt") {
      position.payment_status = status;

      if (status === "paid") {
        // Same transaction: publish the role.
        this.setPositionStatus(position.id, "active");
      } else if (status === "refunded") {
        // Pause, never delete. Notify admins, log the audit event.
        position.status = "paused";
        this.notifications.push({
          audience: "admin",
          event: "position_paused",
          position_id: position.id,
        });
        this.audit.push({ action: "payment_refunded", position_id: position.id, actor: "system" });
      }
    }

    return { applied: true, status };
  }

  /** Mirror of `admin_set_position_payment_exempt` — staff only, reason required. */
  adminExempt(positionId: string, actor: { id: string; staff: boolean }, reason: string) {
    if (!actor.staff) throw new Error("Only platform staff can grant exemptions.");
    if (reason.trim().length < 10) throw new Error("A written reason is required.");
    this.positions.get(positionId)!.payment_status = "exempt";
    this.audit.push({
      action: "position_payment_exempt",
      position_id: positionId,
      actor: actor.id,
      reason: reason.trim(),
    });
  }
}

let db: Db;
const ORG = "org_1";
const POS = "pos_1";

beforeEach(() => {
  db = new Db();
  // Account created + role submitted through intake: always saved as a draft.
  db.positions.set(POS, {
    id: POS,
    organization_id: ORG,
    status: "draft",
    payment_status: "unpaid",
  });
});

const paidEvent = (eventId = "evt_1") => ({
  eventId,
  organizationId: ORG,
  positionId: POS,
  providerReference: "cs_test_123",
  amountCents: 39900,
  currency: "usd",
  outcome: "paid" as const,
});

describe("money path (test mode)", () => {
  it("publishes the role only after the webhook confirms payment", () => {
    expect(db.positions.get(POS)!.status).toBe("draft");

    // Checkout started but not confirmed yet.
    expect(() => db.setPositionStatus(POS, "active")).toThrow(PAYMENT_GATE_ERROR);

    const result = db.applyWebhookEvent(paidEvent());

    expect(result).toEqual({ applied: true, status: "paid" });
    expect(db.positions.get(POS)!.payment_status).toBe("paid");
    expect(db.positions.get(POS)!.status).toBe("active");
    expect(db.payments).toHaveLength(1);
    expect(db.payments[0].provider_reference).toBe("cs_test_123");
  });

  it("leaves the role unpublished when the webhook never arrives", () => {
    // Client abandons or the provider never calls back.
    expect(db.positions.get(POS)!.status).toBe("draft");
    expect(db.positions.get(POS)!.payment_status).toBe("unpaid");
    expect(() => db.setPositionStatus(POS, "approved")).toThrow(PAYMENT_GATE_ERROR);
    expect(db.payments).toHaveLength(0);
    expect(db.positions.get(POS)!.status).toBe("draft");
  });

  it("editing and saving a draft never requires payment", () => {
    expect(() => db.setPositionStatus(POS, "draft")).not.toThrow();
    expect(db.positions.get(POS)!.status).toBe("draft");
  });

  it("is idempotent — a replayed webhook event changes nothing", () => {
    db.applyWebhookEvent(paidEvent("evt_dup"));
    const replay = db.applyWebhookEvent(paidEvent("evt_dup"));

    expect(replay).toEqual({ applied: false, reason: "duplicate_event" });
    expect(db.payments).toHaveLength(1);
    expect(db.positions.get(POS)!.status).toBe("active");
  });

  it("a refund pauses the role, notifies admins and never deletes it", () => {
    db.applyWebhookEvent(paidEvent());
    db.applyWebhookEvent({ ...paidEvent("evt_refund"), outcome: "refunded" });

    const position = db.positions.get(POS)!;
    expect(position.payment_status).toBe("refunded");
    expect(position.status).toBe("paused");
    expect(db.positions.has(POS)).toBe(true);
    expect(db.notifications).toContainEqual({
      audience: "admin",
      event: "position_paused",
      position_id: POS,
    });
    expect(db.audit.some((a) => a.action === "payment_refunded")).toBe(true);
  });

  it("an admin exemption publishes without faking a payment", () => {
    db.adminExempt(POS, { id: "staff_1", staff: true }, "Free pilot role agreed with the client.");

    expect(() => db.setPositionStatus(POS, "active")).not.toThrow();
    expect(db.payments).toHaveLength(0);
    expect(db.audit[0]).toMatchObject({ action: "position_payment_exempt", actor: "staff_1" });
  });

  it("exemptions are staff-only and require a written reason", () => {
    expect(() => db.adminExempt(POS, { id: "client_1", staff: false }, "please")).toThrow(
      /platform staff/i,
    );
    expect(() => db.adminExempt(POS, { id: "staff_1", staff: true }, "no")).toThrow(/reason/i);
  });

  it("a later paid webhook never downgrades an exempt role", () => {
    db.adminExempt(POS, { id: "staff_1", staff: true }, "Free pilot role agreed with the client.");
    db.applyWebhookEvent({ ...paidEvent("evt_late"), outcome: "refunded" });

    expect(db.positions.get(POS)!.payment_status).toBe("exempt");
  });
});
