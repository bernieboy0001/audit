import { Config } from "./config.js";
import { Ledger } from "./ledger.js";
import { narrateOutcome } from "./agents/narrator.js";
import { OutcomeView, PricePoint, Side } from "./types.js";

function priceAtOrAfter(history: PricePoint[], cycle: number): PricePoint | null {
  const pts = history.filter((p) => p.cycle >= cycle);
  return pts.length ? pts[0] : null;
}

/**
 * Re-score every decision that is old enough. The engine computes the
 * outcome from on-chain price data — the LLM only writes the explanation.
 * Returns the outcomes produced this pass.
 */
export async function resolvePendingOutcomes(
  config: Config,
  ledger: Ledger,
  history: PricePoint[],
  horizonCycles: number
): Promise<OutcomeView[]> {
  const entries = ledger.readAll();
  const proposals = entries.filter((e) => e.kind === "proposal");
  const produced: OutcomeView[] = [];

  for (const p of proposals) {
    const id = String(p.data.id);
    const already =
      entries.some((e) => e.kind === "outcome" && e.data.decisionId === id) ||
      entries.some((e) => e.kind === "human_veto" && e.data.decisionId === id);
    if (already) continue;

    const side = String(p.data.side) as Side;
    const entryPrice = Number(p.data.entryPrice);
    const expectedBps = Number(p.data.expectedBps);
    const decidedCycle = Number(p.data.cycle);
    const end = priceAtOrAfter(history, decidedCycle + horizonCycles);
    if (!end || !entryPrice) continue;

    const exitPrice = end.price;
    const realizedBps = ((exitPrice - entryPrice) / entryPrice) * 10000;
    const base = {
      decisionId: id,
      cycle: decidedCycle,
      entryPrice,
      exitPrice,
      realizedBps,
      expectedBps,
      side
    };

    if (side === "hold") {
      const absMove = Math.abs(realizedBps);
      const hit = absMove < 100;
      const note = hit
        ? "stood aside while nothing moved"
        : "stood aside while price moved — no position taken, no capital at risk";
      const view: OutcomeView = { ...base, hit, hold: true, note };
      ledger.append("outcome", view as unknown as Record<string, unknown>, { cycle: decidedCycle });
      attachNarration(config, ledger, id, view, decidedCycle);
      produced.push(view);
      continue;
    }

    const executed = entries.some(
      (e) => e.kind === "execution" && e.data.decisionId === id
    );
    if (executed) {
      const hit =
        Math.sign(realizedBps) === Math.sign(expectedBps) &&
        Math.abs(realizedBps) >= 0.6 * Math.abs(expectedBps);
      const note = hit
        ? "price moved as the trader expected"
        : "price went against the position";
      const view: OutcomeView = { ...base, hit, note };
      ledger.append("outcome", view as unknown as Record<string, unknown>, { cycle: decidedCycle });
      attachNarration(config, ledger, id, view, decidedCycle);
      produced.push(view);
    } else {
      // Auditor vetoed it. Correct if price moved against the proposal.
      const vetoCorrect = Math.sign(realizedBps) !== Math.sign(expectedBps);
      const note = vetoCorrect
        ? "the veto saved money — price went against the proposal"
        : "the veto was unnecessary — the proposal would have worked";
      const view: OutcomeView = {
        ...base,
        hit: false,
        vetoCorrect,
        note
      };
      ledger.append("outcome", view as unknown as Record<string, unknown>, { cycle: decidedCycle });
      attachNarration(config, ledger, id, view, decidedCycle);
      produced.push(view);
    }
  }

  return produced;
}

function attachNarration(
  config: Config,
  ledger: Ledger,
  decisionId: string,
  view: OutcomeView,
  cycle: number
): void {
  void narrateOutcome(config, view)
    .then((text) => {
      if (text) {
        ledger.append(
          "narration",
          { decisionId, text },
          { cycle }
        );
      }
    })
    .catch((e) =>
      console.warn("[outcome] narration failed:", (e as Error).message)
    );
}
