"use client";

import { useState } from "react";
import { humanVeto } from "@/lib/api";
import { fmtPrice } from "@/lib/format";
import type { AppState } from "@/lib/types";

export default function ProposalCard({
  state,
  onReload
}: {
  state: AppState;
  onReload: () => void;
}) {
  const [voting, setVoting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { pending, lastDecision } = state;

  const veto = async () => {
    if (!pending) return;
    setVoting(true);
    const ok = await humanVeto(pending.decisionId);
    setResult(ok ? "vetoed — recorded as on-chain governance evidence" : "failed — is the agent online?");
    setVoting(false);
    onReload();
    setTimeout(() => setResult(null), 5000);
  };

  const left = pending
    ? Math.max(0, pending.dueCycle - state.cycle)
    : 0;
  const remaining = pending && pending.windowCycles > 0
    ? Math.max(0, Math.min(100, (left / pending.windowCycles) * 100))
    : 0;

  return (
    <div className="panel fade-in">
      <h3>Decision desk · trader vs auditor</h3>

      {pending && (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <span className={`badge ${pending.side}`} style={{ fontSize: 13 }}>
              {pending.side.toUpperCase()}
            </span>
            <span className="mono small">
              {pending.sizePct}% of treasury · entry {fmtPrice(pending.entryPrice)} ·{" "}
              expected {pending.expectedBps >= 0 ? "+" : ""}
              {pending.expectedBps} bps
            </span>
            <span className="badge approved">approved · executing</span>
          </div>

          <div className="vs">
            <div className="side">
              <div className="who">
                <span>trader agent</span>
                <span className="blue">{pending.side}</span>
              </div>
              <div className="small">{pending.traderReason}</div>
            </div>
            <div className="versus">VS</div>
            <div className="side">
              <div className="who">
                <span>risk auditor</span>
                <span className="green">approved</span>
              </div>
              <div className="small">{pending.auditorReason}</div>
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <div className="row">
                <span className="small amber">
                  human veto window open
                </span>
                <span className="small muted mono">executes in {left} cycle(s)</span>
              </div>
              <div className="tickbar">
                <div style={{ width: `${remaining}%` }} />
              </div>
            </div>
            <button className="veto" onClick={veto} disabled={voting}>
              {voting ? "sending…" : "VETO THIS TRADE"}
            </button>
          </div>
          {result && <div className="small green" style={{ marginTop: 8 }}>{result}</div>}
        </>
      )}

      {!pending && lastDecision && (
        <div className="vstack">
          <div className="row" style={{ marginBottom: 12 }}>
            <span className={`badge ${lastDecision.side}`} style={{ fontSize: 13 }}>
              {lastDecision.side.toUpperCase()}
            </span>
            <span className="mono small">
              {lastDecision.sizePct}% · entry {fmtPrice(lastDecision.entryPrice)}
            </span>
            <span className={`badge ${lastDecision.verdict}`}>
              {lastDecision.verdict}
            </span>
          </div>
          <div className="vs">
            <div className="side">
              <div className="who">
                <span>trader agent</span>
                <span className="blue">{lastDecision.side}</span>
              </div>
              <div className="small">{lastDecision.traderReason}</div>
            </div>
            <div className="versus">VS</div>
            <div className="side">
              <div className="who">
                <span>risk auditor</span>
                <span className={lastDecision.verdict === "approved" ? "green" : "red"}>
                  {lastDecision.verdict}
                </span>
              </div>
              <div className="small">{lastDecision.auditorReason}</div>
            </div>
          </div>
        </div>
      )}

      {!pending && !lastDecision && (
        <div className="small muted">no decisions yet… the agent is reading the market</div>
      )}
    </div>
  );
}