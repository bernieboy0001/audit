"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TrustGauge from "@/components/TrustGauge";
import PriceChart, { Pt } from "@/components/PriceChart";
import ProposalCard from "@/components/ProposalCard";
import LedgerFeed from "@/components/LedgerFeed";
import OutcomeList from "@/components/OutcomeList";
import EnginePanel from "@/components/EnginePanel";
import { fetchState } from "@/lib/api";
import { fmtPrice } from "@/lib/format";
import type { AppState } from "@/lib/types";

export default function Page() {
  const [state, setState] = useState<AppState | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [points, setPoints] = useState<Pt[]>([]);
  const lastCycle = useRef<number>(-1);

  const poll = useCallback(async () => {
    try {
      const s = await fetchState();
      setState(s);
      setConnected(true);
      setConnError(null);
      setLastSeen(s.ts);
      if (s.cycle !== lastCycle.current && s.price !== null) {
        lastCycle.current = s.cycle;
        setPoints((prev) => {
          const next = [...prev, { cycle: s.cycle, price: s.price as number }];
          return next.slice(-200);
        });
      }
    } catch (e) {
      setConnected(false);
      setConnError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [poll]);

  const online = connected && lastSeen && Date.now() - lastSeen < 10000;

  return (
    <>
      <header className="header">
        <span className={`pulse ${online ? "" : "off"}`} />
        <span className="logo">
          AUDIT<em>⚬</em> self-auditing autonomous fund
        </span>
        <span className="badge">{state?.mode === "demo" ? "demo sandbox" : "live"}</span>
        <span className={`badge ${online ? "ok" : "bad"}`}>
          {online ? "agent online" : "agent offline"}
        </span>
        <span className="badge">cycle {state?.cycle ?? "—"}</span>
        <span className="badge">
          price {state?.price !== null && state?.price !== undefined ? fmtPrice(state.price) : "—"}
        </span>
        <span className="muted small" style={{ marginLeft: "auto" }}>
          no model writes its own score · no trade ships without a human-shaped exit
        </span>
      </header>

      <div className="banner">
        AN AUTONOMOUS AGENT TRADES A REAL ON-CHAIN MARKET. EVERY DECISION IS COMMITTED
        TO A PUBLIC APPEND-ONLY LEDGER AND RE-SCORED ON OUTCOME. IT DOES NOT GET TO
        BLAME THE MODEL FOR ITS NUMBERS — THE ENGINE WRITES THEM, THE MODEL EXPLAINS
        THEM, AND THE LEDGER WATCHES BOTH.
      </div>

      {!online && (
        <div className="conn-error mono small">
          {connError
            ? `connecting to agent… ${connError} — Render&apos;s free tier sleeps after ~15 min idle and takes ~60 s to wake; this banner clears by itself.`
            : "connecting to agent…"}
        </div>
      )}

      <div className="grid">
        <div>
          {state && <TrustGauge trust={state.trust} />}
          {state && <EnginePanel state={state} />}
        </div>
        <div>
          <PriceChart points={points} />
          {state && <ProposalCard state={state} onReload={poll} />}
          {state && <OutcomeList outcomes={state.recentOutcomes} />}
        </div>
        <div>{state && <LedgerFeed entries={state.recentEntries} />}</div>
      </div>

      <footer style={{ textAlign: "center", padding: "20px", color: "#4a5364" }} className="small mono">
        AUDIT · the black box recorder for AI agents · crafted for the Orion Builder Hackathon
      </footer>
    </>
  );
}