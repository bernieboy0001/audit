import type { AppState } from "./types";

export const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8787";

export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL || "https://sepolia.basescan.org";

export function txLink(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export async function fetchState(): Promise<AppState | null> {
  try {
    const r = await fetch(`${AGENT_URL}/state`, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as AppState;
  } catch {
    return null;
  }
}

export async function humanVeto(decisionId: string): Promise<boolean> {
  try {
    const r = await fetch(`${AGENT_URL}/human-veto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisionId })
    });
    return r.ok;
  } catch {
    return false;
  }
}