/**
 * Real LLM caller. Every decision node goes through here — nothing is mocked.
 *
 * Default provider: Pollinations keyless GET endpoint
 *   https://text.pollinations.ai/{urlencoded_prompt}?model=openai
 * (no API key needed). Override with the LLM_BASE_URL env var.
 *
 * NOTE: the POST endpoint https://text.pollinations.ai/openai is NOT used —
 * it times out from this environment.
 */
import type { Decision } from "./types";

const DEFAULT_BASE_URL = "https://text.pollinations.ai";
const DEFAULT_TIMEOUT_MS = 45000;

function baseUrl(): string {
  return (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Raw HTTP GET to the LLM. Throws on non-2xx, timeout (45s), or network failure. */
export async function callPollinations(
  prompt: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<string> {
  const url = `${baseUrl()}/${encodeURIComponent(prompt)}?model=openai`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "flyrank-ai-decision-flow/0.1",
        Accept: "text/plain",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `LLM request failed: HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`
      );
    }
    return (await res.text()).trim();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`LLM request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Same as callPollinations, but retries ONCE after a short delay on transient failures. */
async function callWithOneRetry(prompt: string): Promise<string> {
  try {
    return await callPollinations(prompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Don't retry timeouts — they already consumed 45s.
    if (/timed out/.test(msg)) throw err;
    await sleep(2000);
    return await callPollinations(prompt);
  }
}

function tokensOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Parse a YES/NO answer robustly: scan the first tokens for a standalone
 * "yes"/"no" (case/punctuation insensitive), then fall back to a final line
 * containing only YES/NO ("Final answer:" style prompts).
 */
export function parseYesNo(text: string): Decision | null {
  if (!text) return null;
  const tokens = tokensOf(text).slice(0, 12);
  for (const t of tokens) {
    if (t === "yes") return "YES";
    if (t === "no") return "NO";
  }
  const lines = text
    .split("\n")
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);
  const last = lines[lines.length - 1];
  if (last === "yes") return "YES";
  if (last === "no") return "NO";
  return null;
}

function buildPrompt(question: string, context: string, repair: boolean): string {
  const ctx = context.trim()
    ? `\nDecisions made earlier in this workflow:\n${context.trim()}\n`
    : "";
  const instruction = repair
    ? "IMPORTANT: Reply with ONLY the single word YES or NO. No other text."
    : "Think briefly, then write your final answer on its own last line as exactly YES or NO.";
  return (
    `You are a decision node in an AI workflow. Answer the question below.\n\n` +
    `Question: ${question}\n${ctx}\n${instruction}`
  );
}

export interface DecisionResult {
  decision: Decision;
  raw: string;
  /** True when the answer only became parseable after the repair retry. */
  repaired: boolean;
}

/**
 * Ask the LLM a yes/no question. If the first response isn't parseable,
 * performs ONE repair retry asking for only "YES" or "NO", then throws.
 */
export async function decideYesNo(
  question: string,
  context: string
): Promise<DecisionResult> {
  const raw = await callWithOneRetry(buildPrompt(question, context, false));
  const parsed = parseYesNo(raw);
  if (parsed) return { decision: parsed, raw, repaired: false };

  const raw2 = await callWithOneRetry(buildPrompt(question, context, true));
  const parsed2 = parseYesNo(raw2);
  if (parsed2) return { decision: parsed2, raw: raw2, repaired: true };

  throw new Error(
    `Could not parse a YES/NO answer from the LLM response (after 1 repair retry). ` +
      `Response was: ${raw2.slice(0, 300)}`
  );
}
