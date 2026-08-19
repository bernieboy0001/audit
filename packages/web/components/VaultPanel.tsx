"use client";

import { fmtWei } from "@/lib/format";
import type { AppState } from "@/lib/types";

export default function VaultPanel({ state }: { state: AppState }) {
  const { treasury } = state;
  return (
    <div className="panel">
      <h3>The AI&apos;s vault — what it&apos;s spending</h3>
      <div className="vault">
        <div className="vaultrow">
          <span>
            <span className="vaultsym">AUTH</span>
            <span className="small muted">the asset it trades</span>
          </span>
          <b className="mono">{treasury ? fmtWei(treasury.auth) : "—"}</b>
        </div>
        <div className="vaultrow">
          <span>
            <span className="vaultsym">AUDS</span>
            <span className="small muted">the stable it buys with</span>
          </span>
          <b className="mono">{treasury ? fmtWei(treasury.auds) : "—"}</b>
        </div>
      </div>
      <div className="small muted" style={{ marginTop: 8 }}>
        Demo tokens on Base testnet · balances read live from the chain every heartbeat.
      </div>
    </div>
  );
}