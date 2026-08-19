import { ethers } from "ethers";
import { Config } from "./config.js";
import {
  Chain,
  commitDecision,
  doSwap,
  getAmountOut,
  getBalances,
  getPriceNum,
  getReserves
} from "./chain.js";
import { canonical } from "./ledger.js";
import { computeSignals } from "./signals.js";
import { Store } from "./store.js";
import { resolvePendingOutcomes } from "./outcome.js";
import { proposeTrade } from "./agents/trader.js";
import { reviewProposal } from "./agents/auditor.js";
import { narrateDecision, narrateExecution } from "./agents/narrator.js";
import { calibrateConfidence, rollingAccuracy } from "./learn.js";
import {
  DecisionView,
  ExecutionView,
  PendingDecision,
  Side
} from "./types.js";

const ETHER = 1e18;

async function executeDecision(
  chain: Chain,
  config: Config,
  store: Store,
  p: PendingDecision
): Promise<void> {
  const treasury = store.treasury!;
  const authWei = BigInt(treasury.auth);
  const audsWei = BigInt(treasury.auds);
  const tokenIn: "auth" | "auds" = p.side === "buy" ? "auds" : "auth";
  const amountIn =
    ((tokenIn === "auds" ? audsWei : authWei) *
      BigInt(Math.round(p.sizePct))) /
    100n;
  if (amountIn <= 0n) return;

  const [r0, r1] = await getReserves(chain);
  const reserveIn = tokenIn === "auds" ? r1 : r0;
  const reserveOut = tokenIn === "auds" ? r0 : r1;
  const rawOut = await getAmountOut(chain, amountIn, reserveIn, reserveOut);
  const minOut = (rawOut * 95n) / 100n;

  try {
    const { txHash } = await doSwap(chain, tokenIn, amountIn, minOut);

    // Commit the execution on-chain. The registry rejects exact duplicate
    // hashes, so the exec hash is derived from the decision hash plus a phase
    // marker: unique, yet provably linked to the already-public intent.
    const decisionEntry = store.ledger.decision(p.decisionId);
    let chainEntry: number | undefined;
    let commitTx = "";
    if (decisionEntry) {
      const decisionHash = ethers.keccak256(
        ethers.toUtf8Bytes(canonical(decisionEntry.data))
      );
      const execHash = ethers.keccak256(
        ethers.concat([
          ethers.getBytes(decisionHash),
          ethers.toUtf8Bytes(`|exec:${p.decisionId}`)
        ])
      );
      const res = await commitDecision(chain, execHash, `exec:${p.decisionId}`);
      chainEntry = res.entryIndex;
      commitTx = res.txHash;
    }

    const receivedToken: "auth" | "auds" = tokenIn === "auds" ? "auth" : "auds";
    const exec: ExecutionView = {
      decisionId: p.decisionId,
      cycle: store.cycle,
      txHash,
      chainEntry,
      paid: amountIn.toString(),
      paidToken: tokenIn,
      received: rawOut.toString(),
      receivedToken
    };
    store.lastExecution = exec;
    store.ledger.append(
      "execution",
      { ...exec, commitTx },
      { cycle: store.cycle, txHash, chainEntry }
    );
    // Narration is prose-overhead, not a decision input: fire it without ever
    // stalling the loop cadence. It lands in the ledger a moment later.
    void narrateExecution(config, exec)
      .then((narrator) => {
        if (narrator) {
          store.ledger.append(
            "narration",
            { decisionId: p.decisionId, text: narrator },
            { cycle: store.cycle }
          );
        }
      })
      .catch((e) => console.warn("[loop] exec narration failed:", (e as Error).message));
  } catch (e) {
    store.ledger.append(
      "risk_violation",
      { decisionId: p.decisionId, error: (e as Error).message },
      { cycle: store.cycle }
    );
  }
}

export async function cycle(
  chain: Chain,
  config: Config,
  store: Store
): Promise<void> {
  store.cycle += 1;
  const cycleNo = store.cycle;

  const [r0, r1] = await getReserves(chain);
  store.reserves = { auth: r0.toString(), auds: r1.toString() };
  const price = await getPriceNum(chain);
  store.pushPrice({ cycle: cycleNo, ts: Date.now(), price });

  const engine = computeSignals(store.priceHistory.map((p) => p.price));
  store.engine = engine;

  const bal = await getBalances(chain, await chain.agent.getAddress());
  store.treasury = { auth: bal.auth.toString(), auds: bal.auds.toString() };
  const treasury = {
    auth: Number(bal.auth) / ETHER,
    auds: Number(bal.auds) / ETHER
  };
  const authValue = treasury.auth * price;
  const authShare =
    authValue + treasury.auds > 0 ? authValue / (authValue + treasury.auds) : 0;

  // 1. Re-score decisions that are old enough.
  const outcomes = await resolvePendingOutcomes(
    config,
    store.ledger,
    store.priceHistory,
    config.outcomeHorizonCycles
  );
  if (outcomes.length) store.recentOutcomes.push(...outcomes);
  // 1b. The AI's memory: recompute its verified hit-rate and bake it in.
  store.tracking = rollingAccuracy(store.ledger.readAll());

  // 2. Execute a decision whose veto window has passed (if not human-vetoed).
  if (store.pending && cycleNo >= store.pending.dueCycle) {
    const p = store.pending;
    store.pending = null;
    if (!store.humanVetoes.includes(p.decisionId)) {
      await executeDecision(chain, config, store, p);
    }
  }

  // 3. Propose a fresh decision when nothing is pending.
  if (!store.pending) {
    const proposal = await proposeTrade(config, {
      engine,
      treasury,
      tracking: store.tracking,
      position: { authShare },
      recentSides: store.ledger
        .readAll()
        .filter((e) => e.kind === "proposal")
        .slice(-5)
        .map((e) => String(e.data.side) as Side)
    });

    let finalProposal = proposal;
    if (proposal.side === "sell" && Number(bal.auth) < ETHER / 1000) {
      finalProposal = {
        ...proposal,
        side: "hold",
        sizePct: 0,
        reason: "No AUTH position to sell — standing down."
      };
    }
    if (proposal.side === "buy" && Number(bal.auds) < ETHER / 1000) {
      finalProposal = {
        ...proposal,
        side: "hold",
        sizePct: 0,
        reason: "No AUDS to deploy — standing down."
      };
    }

    const review = await reviewProposal(config, {
      proposal: finalProposal,
      engine,
      treasury,
      tracking: store.tracking
    });

    const decision: DecisionView = {
      id: `d${cycleNo}-${Date.now()}`,
      cycle: cycleNo,
      ts: Date.now(),
      side: finalProposal.side,
      sizePct: finalProposal.sizePct,
      entryPrice: price,
      expectedBps: engine.expectedBps,
      confidence: calibrateConfidence(engine.confidence, store.tracking),
      traderReason: finalProposal.reason,
      traderTools: finalProposal.toolsUsed,
      riskFlags: finalProposal.riskFlags,
      verdict: review.verdict,
      auditorReason: review.reason,
      auditorChecks: review.checks
    };

    store.ledger.append(
      "proposal",
      decision as unknown as Record<string, unknown>,
      { cycle: cycleNo }
    );
    store.ledger.append(
      "review",
      {
        decisionId: decision.id,
        verdict: review.verdict,
        reason: review.reason,
        checks: review.checks,
        hardViolations: review.hardViolations
      },
      { cycle: cycleNo }
    );

    const narratorCall = narrateDecision(config, decision, review.reason)
      .then((text) => {
        if (text) {
          store.ledger.append(
            "narration",
            { decisionId: decision.id, text },
            { cycle: cycleNo }
          );
        }
      })
      .catch((e) =>
        console.warn("[loop] decision narration failed:", (e as Error).message)
      );
    void narratorCall;

    store.lastDecision = decision;

    if (decision.side !== "hold" && review.verdict === "approved") {
      // Commit the intent on-chain BEFORE execution: the plan is public,
      // the execution proves the agent kept its word, and a human veto
      // becomes on-chain evidence too.
      try {
        const hash = ethers.keccak256(
          ethers.toUtf8Bytes(canonical(decision as unknown as Record<string, unknown>))
        );
        const res = await commitDecision(chain, hash, `decide:${decision.id}`);
        store.ledger.append(
          "commit",
          { decisionId: decision.id, hash, chainEntry: res.entryIndex },
          { cycle: cycleNo, txHash: res.txHash, chainEntry: res.entryIndex }
        );
      } catch (e) {
        console.warn("[loop] intent commit failed:", (e as Error).message);
      }
      store.pending = {
        decisionId: decision.id,
        side: decision.side,
        sizePct: decision.sizePct,
        entryPrice: decision.entryPrice,
        expectedBps: decision.expectedBps,
        confidence: decision.confidence,
        dueCycle: cycleNo + config.vetoWindowCycles,
        windowCycles: config.vetoWindowCycles,
        createdAt: Date.now(),
        verdict: "approved",
        traderReason: decision.traderReason,
        auditorReason: decision.auditorReason
      };
    } else if (decision.side === "hold") {
      store.ledger.append(
        "hold",
        { decisionId: decision.id, side: "hold", reason: decision.traderReason },
        { cycle: cycleNo }
      );
    }
    // Auditor-vetoed decisions are resolved by the outcome engine later.
  }
}

export function startLoop(
  chain: Chain,
  config: Config,
  store: Store
): NodeJS.Timeout {
  let inFlight = false;
  const run = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      await cycle(chain, config, store);
      store.forceRun = false;
    } catch (e) {
      console.error("[loop] cycle failed:", (e as Error).message);
    } finally {
      store.save();
      inFlight = false;
    }
  };

  void run();
  return setInterval(() => void run(), config.cycleMs);
}
