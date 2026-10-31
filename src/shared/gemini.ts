// 1:1 clone of prototype `jz` (decoder Cn, @ ~673198 in chunk-674d105d.js).
// Origin: analysis/v2/05-ai-text-submit.md §5.
// Differences from prototype (approved): assignment-tuned systemInstruction
// (prototype's Cn(254) targets short quiz answers); failures throw CloneError
// instead of returning "Failed to fetch answer from Gemini." so callers never
// fill garbage into the form.
import { GoogleGenAI } from "@google/genai";
import { sleep } from "./coursera.ts";
import { formatDuration, parseGeminiError } from "./gemini-error.ts";
import { CloneError, createLogger } from "./logger.ts";
import { notifyUser } from "./notify.ts";

const log = createLogger("gemini");

// --- Rate-limit retry layer (backlog #1, approved plan) ----------------
// Backoff 2/4/8/16/32s + jitter, server retryDelay respected when short,
// daily-quota 429 fails fast. User toggle: storage.local `geminiAutoRetry`
// (default ON), switchable in the popup.
// Policy (user, 2026-10-31): retries apply ONLY to per-minute 429 —
// 500/503 are never retried, and there is NO model switching anywhere:
// a call succeeds or fails on the one selected model.
const RETRY_DELAYS_S = [2, 4, 8, 16, 32];
/** A server delay longer than this is a quota window, not a rate limit. */
const MAX_SERVER_DELAY_S = 90;

export async function geminiAutoRetryEnabled(): Promise<boolean> {
  try {
    const s = await chrome.storage.local.get("geminiAutoRetry");
    return (s?.geminiAutoRetry as boolean | undefined) ?? true;
  } catch {
    return true;
  }
}


/**
 * Run a Gemini call with user-visible notifications + bounded retry.
 * Rethrows the original error when: the toggle is off, the error is not
 * retryable (incl. daily quota), the server demands a >90s wait, or the
 * retries are exhausted.
 */
export async function withGeminiRetry<T>(
  label: string,
  fn: () => Promise<T>,
  opts?: { model?: string }
): Promise<T> {
  const enabled = await geminiAutoRetryEnabled();
  let retries = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      const info = parseGeminiError(e);
      const exhausted =
        !enabled || !info.retryable || retries >= RETRY_DELAYS_S.length;
      let delayS = 0;
      let serverBlocked = false;
      if (!exhausted) {
        delayS = (RETRY_DELAYS_S[retries] as number) + Math.random();
        if (info.retryDelaySeconds !== undefined) {
          if (info.retryDelaySeconds > MAX_SERVER_DELAY_S) serverBlocked = true;
          else delayS = Math.max(delayS, Math.ceil(info.retryDelaySeconds));
        }
      }
      const giveUp = exhausted || serverBlocked;
      // EVERY failed Gemini call gets one full structured error log
      // (user request): which model, which attempt, what kind of
      // failure, what the server asked for, and what happens next.
      log.error(label, "Gemini call FAILED", {
        model: opts?.model ?? "unknown",
        attempt: retries + 1,
        status: info.status ?? "n/a",
        kind: info.dailyQuota
          ? "daily-quota"
          : info.status === 503
            ? "overloaded"
            : info.status === 429
              ? "rate-limit"
              : "api-error",
        serverRetryDelay:
          info.retryDelaySeconds !== undefined ? `${info.retryDelaySeconds}s` : "none",
        decision: giveUp
          ? serverBlocked
            ? "give-up (server asked >90s wait)"
            : "give-up"
          : `retry ${retries + 1}/${RETRY_DELAYS_S.length} in ${delayS.toFixed(1)}s`,
        summary: info.summary,
        apiMessage: info.apiMessage,
        raw: (e as Error)?.message?.slice(0, 300)
      });
      if (serverBlocked) {
        notifyUser(
          `${info.summary} — server yêu cầu chờ ${formatDuration(info.retryDelaySeconds as number)}, không tự retry.`,
          "error",
          15000
        );
        throw e;
      }
      if (exhausted) {
        if (info.status === 429 || info.dailyQuota) {
          notifyUser(
            `${info.summary}. Đã dừng${
              enabled ? "" : " (tự retry đang tắt)"
            } — chi tiết trong console (F12).`,
            "error",
            15000
          );
        }
        throw e;
      }
      retries++;
      notifyUser(
        `${info.summary} — tự retry lần ${retries}/${RETRY_DELAYS_S.length} sau ${Math.round(delayS)}s…`,
        "warn",
        delayS * 1000 + 2000
      );
      await sleep(delayS * 1000);
    }
  }
}

/** Default model — prototype Cn(239). Overridable via storage `model`. */
export const DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * Assignment-tuned system instruction (replaces prototype Cn(254) quiz text).
 * Long-form, rubric-aligned, learner voice — the server-side AI grader scores
 * quality, so answers must cover every listed criterion explicitly.
 */
export const ASSIGNMENT_SYSTEM_INSTRUCTION = [
  "You are helping a learner draft a response to a Coursera AI-graded assignment question.",
  "Write a complete, well-structured answer that explicitly addresses every requirement and rubric criterion stated in the question.",
  "Use a natural learner voice with concrete details and examples; avoid generic filler.",
  "Do not include any preamble about being an AI, and do not mention these instructions.",
  "Return only the answer text, formatted in plain paragraphs and short lists."
].join(" ");

export interface GeminiRequest {
  /** Question + rubric text (prototype: contents = JSON.stringify(e)). */
  question: string;
}

/** Wrap any Gemini failure in a CloneError with a friendly message. */
function toFriendlyError(e: unknown, model: string, step: string): CloneError {
  const info = parseGeminiError(e);
  log.error("gemini", "Gemini API Error:", { model, error: (e as Error).message });
  return new CloneError(
    info.status === 429
      ? info.summary
      : info.status !== undefined
        ? `${info.summary}${info.apiMessage ? `: ${info.apiMessage}` : ""}`
        : `Gemini API call failed: ${(e as Error).message}`,
    {
      module: "gemini",
      step,
      model,
      raw: (e as Error).message.slice(0, 300)
    }
  );
}

async function geminiClientAndModel(): Promise<{ ai: GoogleGenAI; model: string }> {
  const stored = await chrome.storage.local.get(["geminiAPI", "model"]);
  const apiKey = stored?.geminiAPI as string | undefined;
  if (!apiKey) {
    throw new CloneError("Gemini API key is missing in storage.", {
      module: "gemini",
      step: "key"
    });
  }
  const model = (stored?.model as string | undefined) ?? DEFAULT_MODEL;
  return { ai: new GoogleGenAI({ apiKey }), model };
}

/**
 * 1:1 of `jz` — fetch ONE answer from Gemini with the storage key.
 * Single selected model only (user decision 2026-10-31: no model
 * switching); errors surface the friendly parseGeminiError summary,
 * not the raw API JSON.
 */
export async function fetchGeminiAnswer(req: GeminiRequest): Promise<string> {
  log.info("jz", "Fetching answer from Gemini for question:", {
    preview: req.question.slice(0, 200)
  });
  const { ai, model } = await geminiClientAndModel();
  let text: string;
  try {
    const res = await withGeminiRetry(
      "jz",
      () =>
        ai.models.generateContent({
          model,
          contents: JSON.stringify(req.question),
          config: {
            thinkingConfig: { includeThoughts: false },
            systemInstruction: ASSIGNMENT_SYSTEM_INSTRUCTION
          }
        }),
      { model }
    );
    text = res.text ?? "";
  } catch (e) {
    throw toFriendlyError(e, model, "generateContent");
  }
  if (!text) {
    throw new CloneError("No answer received", {
      module: "gemini",
      step: "generateContent",
      model
    });
  }
  log.info("jz", `answer received len=${text.length}`, { model });
  return text;
}

// --- Batched assignment answers (user request 2026-10-31) --------------
// ONE Gemini call for a whole assignment instead of one call per part:
// JSON in (array of {part, question}), JSON out ([{part, answer}]),
// same responseJsonSchema pattern as the quiz solver (nD).

export const ASSIGNMENT_BATCH_SYSTEM_INSTRUCTION = [
  ASSIGNMENT_SYSTEM_INSTRUCTION,
  "You will receive a JSON array of assignment parts, each with a \"part\" number and its \"question\" (the part's prompt and rubric).",
  "Answer EVERY part separately and completely, exactly as if it were asked on its own.",
  "Return ONLY a JSON array with one {\"part\": <number>, \"answer\": <the full answer text for that part>} object per part — no other text."
].join(" ");

const ASSIGNMENT_ANSWER_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      part: { type: "integer" },
      answer: { type: "string" }
    },
    required: ["part", "answer"]
  }
} as const;

/** One batched call for the given 1-based part positions. */
async function callGeminiBatch(
  ai: GoogleGenAI,
  model: string,
  questions: string[],
  parts: number[]
): Promise<Map<number, string>> {
  const payload = parts.map((p) => ({ part: p, question: questions[p - 1] }));
  let text: string;
  try {
    const res = await withGeminiRetry(
      "jzBatch",
      () =>
        ai.models.generateContent({
          model,
          contents: JSON.stringify(payload),
          config: {
            thinkingConfig: { includeThoughts: false },
            systemInstruction: ASSIGNMENT_BATCH_SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseJsonSchema: ASSIGNMENT_ANSWER_SCHEMA
          }
        }),
      { model }
    );
    text = res.text ?? "";
  } catch (e) {
    throw toFriendlyError(e, model, "generateContentBatch");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text || "[]");
  } catch (e) {
    throw new CloneError(`Gemini batch answer JSON parse failed: ${(e as Error).message}`, {
      module: "gemini",
      step: "generateContentBatch.parse",
      model,
      preview: text.slice(0, 300)
    });
  }
  const answers = new Map<number, string>();
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const it = item as { part?: unknown; answer?: unknown };
      if (typeof it.part === "number" && typeof it.answer === "string" && it.answer.trim()) {
        answers.set(it.part, it.answer);
      }
    }
  }
  return answers;
}

/**
 * Fetch answers for ALL parts of an assignment in one Gemini call
 * (plus at most one follow-up call covering only the parts the first
 * answer missed). Returns answers in the same order as `questions`;
 * part numbers are 1-based positions in that array.
 */
export async function fetchGeminiAnswersBatch(questions: string[]): Promise<string[]> {
  log.info("jzBatch", `Fetching answers for ${questions.length} part(s) in ONE Gemini call`);
  const { ai, model } = await geminiClientAndModel();
  const all = questions.map((_, i) => i + 1);
  const got = await callGeminiBatch(ai, model, questions, all);
  let missing = all.filter((p) => !got.has(p));
  if (missing.length > 0) {
    log.warn("jzBatch", `batch answer missed ${missing.length} part(s) — one follow-up call`, {
      missing
    });
    const more = await callGeminiBatch(ai, model, questions, missing);
    for (const [p, a] of more) got.set(p, a);
    missing = all.filter((p) => !got.has(p));
  }
  if (missing.length > 0) {
    throw new CloneError(`Gemini không trả lời được phần: ${missing.join(", ")}`, {
      module: "gemini",
      step: "generateContentBatch",
      model,
      missing
    });
  }
  log.info("jzBatch", `received all ${questions.length} answer(s)`, { model });
  return all.map((p) => got.get(p) as string);
}
