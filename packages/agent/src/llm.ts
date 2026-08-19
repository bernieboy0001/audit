import { LlmConfig } from "./config.js";

const OPENAI_COMPAT_PATH = "/v1/chat/completions";

export interface LlmResult {
  ok: boolean;
  text?: string;
  json?: Record<string, unknown>;
  error?: string;
}

async function callLlm(
  config: LlmConfig,
  system: string,
  user: string
): Promise<string | null> {
  if (!config.enabled) return null;
  try {
    const res = await fetch(`${config.baseUrl}${OPENAI_COMPAT_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.4
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data?.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.warn("[llm] call failed:", (e as Error).message);
    return null;
  }
}

export async function llmJson(
  config: LlmConfig,
  system: string,
  user: string
): Promise<Record<string, unknown> | null> {
  const text = await callLlm(config, system, user);
  if (!text) return null;
  try {
    const cleaned = text
      .replace(/^```(?:json)?/m, "")
      .replace(/```$/m, "")
      .trim();
    const json = JSON.parse(cleaned);
    return typeof json === "object" && json !== null ? json : null;
  } catch {
    console.warn("[llm] response was not JSON, falling back");
    return null;
  }
}

export async function llmText(
  config: LlmConfig,
  system: string,
  user: string
): Promise<string | null> {
  return callLlm(config, system, user);
}
