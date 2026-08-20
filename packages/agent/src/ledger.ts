import * as fs from "fs";
import { ethers } from "ethers";
import { LedgerEntry, LedgerKind } from "./types.js";

function sort(o: unknown): unknown {
  if (Array.isArray(o)) return o.map(sort);
  if (o && typeof o === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o as Record<string, unknown>).sort())
      out[k] = sort((o as Record<string, unknown>)[k]);
    return out;
  }
  return o;
}

/** Deterministic canonical JSON — same input always hashes the same. */
export function canonical(obj: unknown): string {
  return JSON.stringify(sort(obj));
}

export function hashEntry(data: Record<string, unknown>, kind: LedgerKind, ts: number, cycle: number): string {
  return ethers.keccak256(
    ethers.toUtf8Bytes(canonical({ kind, ts, cycle, data }))
  );
}

export class Ledger {
  constructor(private file: string) {}

  append(
    kind: LedgerKind,
    data: Record<string, unknown>,
    opts: { ts?: number; cycle: number; txHash?: string; chainEntry?: number } = { cycle: 0 }
  ): LedgerEntry {
    const ts = opts.ts ?? Date.now();
    const entry: LedgerEntry = {
      kind,
      ts,
      cycle: opts.cycle,
      hash: hashEntry(data, kind, ts, opts.cycle),
      data
    };
    if (opts.txHash) entry.txHash = opts.txHash;
    if (opts.chainEntry !== undefined) entry.chainEntry = opts.chainEntry;
    fs.appendFileSync(this.file, JSON.stringify(entry) + "\n");
    return entry;
  }

  readAll(): LedgerEntry[] {
    if (!fs.existsSync(this.file)) return [];
    return fs
      .readFileSync(this.file, "utf8")
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as LedgerEntry);
  }

  tail(n: number): LedgerEntry[] {
    return this.readAll().slice(-n);
  }

  reset(): void {
    fs.writeFileSync(this.file, "");
  }

  decision(id: string): LedgerEntry | undefined {
    return this.readAll().find(
      (e) => e.kind === "proposal" && e.data.id === id
    );
  }
}
