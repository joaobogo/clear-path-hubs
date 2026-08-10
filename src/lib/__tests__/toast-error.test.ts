import { describe, it, expect, vi, beforeEach } from "vitest";

const errors: Array<{ msg: string; opts?: { description?: string } }> = [];
vi.mock("sonner", () => ({
	toast: {
		error: (msg: string, opts?: { description?: string }) => {
			errors.push({ msg, opts });
		},
	},
}));

const { toastError } = await import("@/lib/toast-error");

describe("toastError", () => {
	beforeEach(() => {
		errors.length = 0;
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	it("passes an intentional, human-written message through verbatim", () => {
		toastError(new Error("This candidate already moved to interview."));
		expect(errors[0]?.msg).toBe("This candidate already moved to interview.");
		expect(errors[0]?.opts?.description).toBeUndefined();
	});

	it("strips a leading Error: prefix from intentional messages", () => {
		toastError(new Error("Error: You already responded to this request."));
		expect(errors[0]?.msg).toBe("You already responded to this request.");
	});

	it("replaces raw database text with graceful copy plus a reference", () => {
		toastError(new Error('relation "candidate_matches" does not exist'));
		expect(errors[0]?.msg).not.toContain("candidate_matches");
		expect(errors[0]?.opts?.description).toMatch(/Reference: TF-/);
	});

	it("never surfaces provider or auth internals", () => {
		for (const raw of [
			"Expected 3 parts in JWT; got 1",
			"PGRST301: JWSError",
			'{"code":"42501","message":"permission denied"}',
			"TypeError: x is null\n    at Object.handler (/src/lib/a.ts:12:9)",
			"[object Response]",
		]) {
			errors.length = 0;
			toastError(new Error(raw));
			const shown = `${errors[0]?.msg} ${errors[0]?.opts?.description ?? ""}`;
			expect(shown).not.toContain(raw);
			expect(shown).toMatch(/Reference: TF-/);
		}
	});

	it("falls back gracefully for non-Error throws", () => {
		toastError("boom");
		expect(errors[0]?.opts?.description).toMatch(/Reference: TF-/);
	});

	it("honours an explicit fallback title", () => {
		toastError(new Error("sql error near select"), { fallback: "Save failed" });
		expect(errors[0]?.msg).toBe("Save failed");
	});
});
