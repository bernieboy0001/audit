import { describe, expect, it } from "vitest";
import { computeTrust } from "../src/trust.js";
import { LedgerEntry } from "../src/types.js";

function entry(kind: LedgerEntry["kind"], data: Record<string, unknown>): LedgerEntry {
  return { kind, ts: Date.now(), cycle: 1, hash: "x", data };
}

describe("computeTrust", () => {
  it("starts at 50 with nothing resolved", () => {
    const t = computeTrust([]);
    expect(t.score).toBe(50);
  });

  it("rises on hits and falls on misses", () => {
    const entries = [
      entry("proposal", { id: "1" }),
      entry("outcome", { decisionId: "1", hit: true }),
      entry("proposal", { id: "2" }),
      entry("outcome", { decisionId: "2", hit: false })
    ];
    const t = computeTrust(entries);
    expect(t.score).toBe(50 + 6 - 8);
    expect(t.hits).toBe(1);
    expect(t.misses).toBe(1);
    expect(t.totalDecisions).toBe(2);
    expect(t.resolved).toBe(2);
  });

  it("rewards correct auditor vetoes and punishes wrong ones", () => {
    const entries = [
      entry("proposal", { id: "1" }),
      entry("review", { verdict: "vetoed" }),
      entry("outcome", { decisionId: "1", vetoCorrect: true }),
      entry("proposal", { id: "2" }),
      entry("review", { verdict: "vetoed" }),
      entry("outcome", { decisionId: "2", vetoCorrect: false })
    ];
    const t = computeTrust(entries);
    expect(t.score).toBe(50 + 4 - 5);
    expect(t.vetoes).toBe(2);
    expect(t.vetoCorrect).toBe(1);
  });

  it("punishes risk violations", () => {
    const t = computeTrust([entry("risk_violation", {})]);
    expect(t.score).toBe(40);
  });

  it("counts pending decisions", () => {
    const entries = [
      entry("proposal", { id: "1" }),
      entry("proposal", { id: "2" }),
      entry("outcome", { decisionId: "1", hit: true })
    ];
    expect(computeTrust(entries).pending).toBe(1);
  });

  it("stays inside 0..100", () => {
    const entries: LedgerEntry[] = [];
    for (let i = 0; i < 40; i++) {
      entries.push(entry("proposal", { id: `p${i}` }));
      entries.push(entry("outcome", { decisionId: `p${i}`, hit: false }));
    }
    const t = computeTrust(entries);
    expect(t.score).toBeGreaterThanOrEqual(0);
    expect(t.score).toBeLessThanOrEqual(100);
  });
});
