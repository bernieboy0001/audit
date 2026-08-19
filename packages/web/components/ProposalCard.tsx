"use client";

import { useState } from "react";
import { humanVeto } from "@/lib/api";
import { fmtPrice } from "@/lib/format";
import type { AppState } from "@/lib/types";

function actionWords(side: string): { verb: string; what: string } {
  if (side === "buy")
    return {
      verb: "BUY AUTH",
      what: "it thinks the price is about to rise"
    };
  if (side === "sell")
    return { verb: "SELL AUTH", what: "it thinks the price is about to fall" };
  return { verb: "HOLD", what: "it sees no reason to move" };
}

export default function ProposalCard({
  state,
  onReload
}: {
  state: AppState;
  onReload: () => void;
}) {
  const [voting, setVoting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const { pending, lastDecision } = state;

  const veto = async () => {
    if (!pending) return;
    setVoting(true);
    const ok = await humanVeto(pending.decisionId);
    setResult(
      ok
        ? { ok: true, text: "Stopped. The AI's plan and your veto are now in the public record." }
        : { ok: false, text: "Couldn't reach the AI to stop it. Try again in a second." }
    );
    setVoting(false);
    onReload();
    setTimeout(() => setResult(null), 6000);
  };

  const left = pending ? Math.max(0, pending.dueCycle - state.cycle) : 0;
  const remaining =
    pending && pending.windowCycles > 0
      ? Math.max(0, Math.min(100, (left / pending.windowCycles) * 100))
      : 0;

  return (
    <div className={`panel fade-in ${pending ? "panel-accent" : ""}`}>
      <h3>Decision desk — a human can override</h3>
      <p className="sub">
        Every big move is announced first and recorded on-chain. You get a short
        window to press STOP.
      </p>

      {pending && (
        <div className="desk">
          <div className="row">
            <span className={`badge ${pending.side}`} style={{ fontSize: 12 }}>
              {actionWords(pending.side).verb}
            </span>
            <span className="small muted">
              {pending.sizePct}% of its money · price {fmtPrice(pending.entryPrice)}
            </span>
            <span className="small muted mono">
              engine confidence ≈ {Math.round((pending.confidence ?? 0.5) * 100)}%
            </span>
            <span className="badge warn">waiting for your answer</span>
          </div>

          <div className="planbox trader">
            <div className="who">The AI said</div>
            <div className="text">
              {actionWords(pending.side).what}: &ldquo;{pending.traderReason}&rdquo;
            </div>
          </div>
          <div className="planbox audit">
            <div className="who">The risk check said</div>
            <div className="text">{pending.auditorReason}</div>
          </div>

          <div className="row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="small amber">time left to say no</span>
                <span className="small muted mono">
                  {left <= 0 ? "now" : `${left} cycle${left === 1 ? "" : "s"}`}
                </span>
              </div>
              <div className="tickbar" style={{ marginTop: 5 }}>
                <div style={{ width: `${remaining}%` }} />
              </div>
            </div>
          </div>

          <button
            className="veto"
            onClick={veto}
            disabled={voting}
            aria-label="Stop this trade"
          >
            {voting ? "recording your stop…" : "STOP THIS TRADE"}
          </button>

          {result && (
            <div className={`result ${result.ok ? "green" : "red"}`}>{result.text}</div>
          )}
        </div>
      )}

      {!pending && lastDecision && (
        <div className="desk">
          <div className="row">
            <span className={`badge ${lastDecision.side}`} style={{ fontSize: 12 }}>
              {actionWords(lastDecision.side).verb}
            </span>
            <span className="small muted">
              {lastDecision.sizePct}% of its money · price {fmtPrice(lastDecision.entryPrice)}
            </span>
            <span className="small muted mono">
              engine confidence ≈ {Math.round((lastDecision.confidence ?? 0.5) * 100)}%
            </span>
            <span className={`badge ${lastDecision.verdict}`}>
              {lastDecision.verdict === "approved" ? "allowed to act" : "blocked"}
            </span>
          </div>
          <div className="planbox trader">
            <div className="who">The AI said</div>
            <div className="text">&ldquo;{lastDecision.traderReason}&rdquo;</div>
          </div>
          <div className="planbox audit">
            <div className="who">The risk check said</div>
            <div className="text">{lastDecision.auditorReason}</div>
          </div>
          <div className="small muted">
            Waiting for the veto window to open on the next proposed move…
          </div>
        </div>
      )}

      {!pending && !lastDecision && (
        <div className="small muted">
          No decision yet — the AI is reading the market for the first time.
        </div>
      )}
    </div>
  );
}