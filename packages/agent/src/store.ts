import * as fs from "fs";
import * as path from "path";
import { Config } from "./config.js";
import { Ledger } from "./ledger.js";
import { computeTrust } from "./trust.js";
import { Tracking } from "./learn.js";
import {
  AppState,
  DecisionView,
  EngineOutput,
  ExecutionView,
  InspectionResult,
  OutcomeView,
  PendingDecision,
  PricePoint,
  TrustState
} from "./types.js";

export class Store {
  ledger: Ledger;
  cycle = 0;
  priceHistory: PricePoint[] = [];
  pending: PendingDecision | null = null;
  humanVetoes: string[] = [];
  lastDecision: DecisionView | null = null;
  lastExecution: ExecutionView | null = null;
  recentOutcomes: OutcomeView[] = [];
  forceRun = false;
  reserves: { auth: string; auds: string } | null = null;
  treasury: { auth: string; auds: string } | null = null;
  engine: EngineOutput | null = null;
  lastInspection: InspectionResult | null = null;
  tracking: Tracking = { accuracy: 0.5, samples: 0 };
  mode: string;

  private stateFile: string;
  private priceFile: string;

  constructor(private config: Config) {
    this.ledger = new Ledger(path.join(config.dataDir, "ledger.jsonl"));
    this.stateFile = path.join(config.dataDir, "state.json");
    this.priceFile = path.join(config.dataDir, "priceHistory.json");
    this.mode = config.marketMakerEnabled ? "demo" : "live";
  }

  load(): void {
    if (fs.existsSync(this.priceFile)) {
      try {
        this.priceHistory = JSON.parse(fs.readFileSync(this.priceFile, "utf8"));
      } catch {
        this.priceHistory = [];
      }
    }
    const entries = this.ledger.readAll();
    if (entries.length) {
      this.cycle = Math.max(...entries.map((e) => e.cycle), this.cycle);
    }
  }

  pushPrice(p: PricePoint): void {
    this.priceHistory.push(p);
    if (this.priceHistory.length > 5000) {
      this.priceHistory = this.priceHistory.slice(-2000);
    }
  }

  trust(): TrustState {
    return computeTrust(this.ledger.readAll());
  }

  humanVeto(decisionId: string): boolean {
    if (!this.pending || this.pending.decisionId !== decisionId) return false;
    this.humanVetoes.push(decisionId);
    this.ledger.append(
      "human_veto",
      { decisionId, note: "overridden by human governance" },
      { cycle: this.cycle }
    );
    this.pending = null;
    return true;
  }

  recordInspection(r: InspectionResult): void {
    this.lastInspection = r;
    this.ledger.append(
      "inspection",
      { target: r.target, symbol: r.symbol ?? "—", inMarket: r.inMarket ?? null },
      { cycle: this.cycle }
    );
  }

  snapshot(): AppState {
    const last = this.priceHistory[this.priceHistory.length - 1];
    const prev = this.priceHistory[this.priceHistory.length - 2];
    return {
      ts: Date.now(),
      cycle: this.cycle,
      price: last ? last.price : null,
      priceChangeBps:
        last && prev && prev.price ? ((last.price - prev.price) / prev.price) * 10000 : null,
      reserves: this.reserves,
      treasury: this.treasury,
      engine: this.engine,
      trust: this.trust(),
      pending: this.pending,
      lastDecision: this.lastDecision,
      lastExecution: this.lastExecution,
      recentOutcomes: this.recentOutcomes.slice(-10),
      recentEntries: this.ledger.tail(40),
      humanVetoes: this.humanVetoes,
      inspection: this.lastInspection,
      llm: {
        enabled: this.config.llm.enabled,
        model: this.config.llm.model
      },
      mode: this.mode,
      tracking: this.tracking
    };
  }

  save(): void {
    fs.writeFileSync(this.stateFile, JSON.stringify(this.snapshot(), null, 2));
    fs.writeFileSync(
      this.priceFile,
      JSON.stringify(this.priceHistory.slice(-2000))
    );
  }
}
