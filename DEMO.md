# AUDIT — Demo Script & Judge Q&A

**One-liner to remember:** *Automation is easy. Trust is hard. Before anyone hands an AI money, the first question is "who watches the agent?" — AUDIT is the answer: a fund that trades on Base but never alone.*

---

## 1) Elevator open (15 seconds)

> "Automation is easy. Trust is hard. Every mile of AI agents is being built, but before anyone gives an agent real money, the question is always: *who watches the agent?* AUDIT is the answer — an autonomous fund trading live on Base that **pre-commits every decision on-chain, lets a human veto it, grades every result against reality, and sizes its own bets from its verified track record.** Watch."

---

## 2) Live walkthrough (target: ~3 minutes)

### Beat 1 — Power-up (5s)
"Here's the boot screen — this is a **real live process**, not a video. This page is its cockpit."

### Beat 2 — The decision desk + human override (25s)
"It reads the market every few seconds. When it wants to move, **the AI proposes**, the **risk auditor runs its machine-checkable checklist** [point to audit lines: size ✓ / exposure ✓ / no whipsaw ✓], and then it **waits inside a window for a human**.

**You're the human right now.** [If desk is lit →] PRESS STOP. [Click into ledger →] There it is, written forever: **"overridden by human governance."** A veto the AI cannot delete. That's the control loop."

### Beat 3 — The report card (20s)
"Every decision is **re-judged later against what actually happened** [point at the outcomes list]. That feeds two things: the **trust score** [gauge] and the **verified hit-rate badge** — written by the engine, never by the model. And the model **sizes its own bets from that number**: hot streak → presses the edge; cold streak → shrinks and waits. You can watch it do this live."

### Beat 4 — The vault (15s)
"Every cent is accounted for: the balances, the **net P&L line and equity curve**, each one traceable to a row in the append-only ledger. It's a demo market — the point was never the profit. **The point is that every number on this screen can be verified, down to the hash.**"

### Beat 5 — Audit anything (15s)
"Last trick — the wow. Type any Base address: [type USDC]. AUDIT reads it **straight off Base mainnet, in your browser**: is it a contract? does it have code? is it in the market? what's the price? It **audits anything** — and it only ever trades what it manages, and it says so out loud, so it can never overclaim."

### Close (10s)
"So: an autonomous agent you can actually trust — because **every decision was pre-committed, every veto is on record, every outcome was graded, and the AI is visibly learning from its own verifiable track record.**"

---

## 3) Fallbacks (know these before you walk on)

- **Page sleeping/rebooting:** "Render's free tier sleeps after ~15 min idle — it's waking now, that banner clears itself. The data is persistent, nothing is lost. Meanwhile: here's the architecture."
- **Desk is empty when you want the STOP beat:** skip it and go straight to ledger + outcomes + audit-anything (they work in any state). The STOP button is still in the app for them to try.
- **Rough patch on screen (low trust, bad streak):** "And here's the honest part — it takes a beating in chop, its hit-rate badge shows it, so it **shrinks its bet size and holds**. That's the machinery that protects real money. No fake green line."
- **Someone asks the CA:** audit-anything works on any Base address — use it instead of promises.

---

## 4) Judge Q&A — one breath each

**"Isn't this just a paper-trading toy?"**
The money is demo on testnet — but the machinery isn't. Every intent is committed to a real Base contract, every veto is on-chain, every outcome is graded by an engine, not the model. We're selling the **control loop**, not returns; the AMM is the proof rig.

**"Why does it lose trades sometimes?"**
Because real markets chop, and short-horizon calls lose in chop — that's what it is. That's why it's not naked: it **shrinks when its verified hit-rate drops** and the auditor gates it. A system claiming 100% is lying; one that shows you when it's cold is trustworthy. [Point at badge.]

**"How is this different from every trading bot?"**
Bots optimize returns; this optimizes **accountability**. The intent is pre-committed to a contract, the execution is hash-linked to that intent, the human stop is written forever, and its own verified track record feeds its bet sizing. It's the only one where you can *verify the agent did what it said*.

**"Who would actually use this?"**
Anyone who must delegate money to an autonomous agent — DAO treasuries, fund gatekeepers, compliance teams. **The product is trust; this market is the avatar that proves it works.**

**"How do we know the AI isn't lying to us?"**
It can't. **The engine writes every number** — signals, confidence, outcomes, trust, hit-rate. The LLM writes only prose — derived from the same JSON. You can audit the audit; that's the entire point.

**"What's your security story?"**
The agent's permissions end at its own demo pool. Exposure caps and hard rules are machine-checked, the human veto window is real, the on-chain registry rejects duplicate intents, and there are no secrets in the repo.

**"What's next?"**
Wrap the trust layer as a service — an **approval engine** any agent plugs into before it gets wallet permissions. The dashboard is the interface; the control loop is the API.