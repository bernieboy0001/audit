"use client";

import { txLink } from "@/lib/api";
import { shortHash, timeAgo } from "@/lib/format";
import type { LedgerEntry, LedgerKind } from "@/lib/types";

const KIND_META: Record<LedgerKind, { label: string; cls: string }> = {
  genesis: { label: "genesis", cls: "muted" },
  proposal: { label: "proposal", cls: "blue" },
  review: { label: "review", cls: "amber" },
  execution: { label: "exec", cls: "green" },
  hold: { label: "hold", cls: "muted" },
  outcome: { label: "outcome", cls: "green" },
  human_veto: { label: "human veto", cls: "red" },
  risk_violation: { label: "risk", cls: "red" },
  narration: { label: "narration", cls: "muted" },
  commit: { label: "on-chain commit", cls: "blue" }
};

export default function LedgerFeed({ entries }: { entries: LedgerEntry[] }) {
  return (
    <div className="panel">
      <h3>Append-only ledger · every decision, hashed</h3>
      <div className="scroll">
        {entries.slice().reverse().map((e) => {
          const meta = KIND_META[e.kind] ?? { label: e.kind, cls: "muted" };
          let summary = "";
          if (e.kind === "proposal") {
            const d = e.data as any;
            summary = `${d.side} ${d.sizePct}% → ${d.verdict}`;
          } else if (e.kind === "execution") {
            const d = e.data as any;
            summary = `${d.paidToken}→${d.receivedToken} · entry #${d.chainEntry ?? "?"}`;
          } else if (e.kind === "outcome") {
            const d = e.data as any;
            summary = d.vetoCorrect !== undefined
              ? d.vetoCorrect ? "veto was right ✓" : "veto unnecessary ✗"
              : d.hit ? "hit ✓" : "miss ✗";
          } else if (e.kind === "human_veto") {
            summary = shortHash(String((e.data as any).decisionId ?? ""));
          } else if (e.kind === "hold") {
            summary = "stood down";
          } else if (e.kind === "genesis") {
            summary = "treasury initialized";
          } else if (e.kind === "commit") {
            summary = `intent hashed · registry entry #${(e.data as any).chainEntry}`;
          }
          const hasTx = e.txHash || e.kind === "execution";
          return (
            <div key={e.hash} className="entry">
              <div className="row">
                <span className={`badge ${meta.cls}`}>{meta.label}</span>
                <span className="small muted mono">
                  c{e.cycle} · {timeAgo(e.ts)}
                </span>
              </div>
              <div className="small" style={{ marginTop: 4 }}>
                {summary}
              </div>
              <div className="small muted mono" style={{ marginTop: 3 }}>
                {(e.txHash && (
                  <a href={txLink(e.txHash)} target="_blank" rel="noreferrer">
                    {shortHash(e.txHash, 10)}
                  </a>
                )) || (
                  <span>{shortHash(e.hash, 8)}</span>
                )}
                {e.chainEntry !== undefined && (
                  <span className="muted"> · on-chain #{e.chainEntry}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}