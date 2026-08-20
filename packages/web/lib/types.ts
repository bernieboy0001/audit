export type Side = "buy" | "sell" | "hold";

export interface Signal {
  key: string;
  value: number;
  weight: number;
  note: string;
}

export interface EngineOutput {
  signals: Signal[];
  direction: number;
  expectedBps: number;
  score: number;
  grade: "bullish" | "bearish" | "neutral";
  price: number;
  prevPrice: number;
  confidence: number;
}

export interface DecisionView {
  id: string;
  cycle: number;
  ts: number;
  side: Side;
  sizePct: number;
  entryPrice: number;
  expectedBps: number;
  confidence: number;
  traderReason: string;
  traderTools: string[];
  riskFlags: string[];
  verdict: "approved" | "vetoed";
  auditorReason: string;
  auditorChecks: string[];
}

export interface ExecutionView {
  decisionId: string;
  cycle: number;
  txHash: string;
  chainEntry?: number;
  paid: string;
  paidToken: "auth" | "auds";
  received: string;
  receivedToken: "auth" | "auds";
}

export interface OutcomeView {
  decisionId: string;
  cycle: number;
  entryPrice: number;
  exitPrice: number;
  realizedBps: number;
  expectedBps: number;
  hit: boolean;
  vetoCorrect?: boolean;
  hold?: boolean;
  side?: Side;
  note: string;
}

export interface PendingDecision {
  decisionId: string;
  side: Side;
  sizePct: number;
  entryPrice: number;
  expectedBps: number;
  confidence: number;
  dueCycle: number;
  windowCycles: number;
  createdAt: number;
  verdict: "approved" | "vetoed";
  traderReason: string;
  auditorReason: string;
}

export interface TrustState {
  score: number;
  totalDecisions: number;
  resolved: number;
  hits: number;
  misses: number;
  vetoes: number;
  vetoCorrect: number;
  pending: number;
  history: { ts: number; delta: number; why: string }[];
}

export interface InspectionResult {
  target: string;
  chain: string;
  isContract: boolean;
  agent: string;
  eth?: string;
  symbol?: string;
  name?: string;
  decimals?: number | null;
  inMarket?: string;
  price?: number;
  agentBalance?: string;
  note: string;
}

export type LedgerKind =
  | "genesis"
  | "proposal"
  | "review"
  | "execution"
  | "hold"
  | "outcome"
  | "human_veto"
  | "risk_violation"
  | "narration"
  | "commit"
  | "inspection";

export interface LedgerEntry {
  kind: LedgerKind;
  ts: number;
  cycle: number;
  hash: string;
  txHash?: string;
  chainEntry?: number;
  data: Record<string, unknown>;
}

export interface AppState {
  ts: number;
  cycle: number;
  price: number | null;
  priceChangeBps: number | null;
  reserves: { auth: string; auds: string } | null;
  treasury: { auth: string; auds: string } | null;
  engine: EngineOutput | null;
  trust: TrustState;
  pending: PendingDecision | null;
  lastDecision: DecisionView | null;
  lastExecution: ExecutionView | null;
  recentOutcomes: OutcomeView[];
  recentEntries: LedgerEntry[];
  humanVetoes: string[];
  inspection: InspectionResult | null;
  llm: { enabled: boolean; model: string };
  mode: string;
  conviction?: string;
  tracking: { accuracy: number; samples: number };
  valueHistory: { cycle: number; ts: number; value: number }[];
}