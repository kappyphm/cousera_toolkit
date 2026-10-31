// 1:1 clone of prototype `jz` (decoder Cn, @ ~673198 in chunk-674d105d.js).
// Origin: analysis/v2/05-ai-text-submit.md §5.
// Differences from prototype (approved): assignment-tuned systemInstruction
// (prototype's Cn(254) targets short quiz answers); failures throw CloneError
// instead of returning "Failed to fetch answer from Gemini." so callers never
// fill garbage into the form.
import { GoogleGenAI } from "@google/genai";
import { sleep } from "./coursera.ts";
import { formatDuration, modelCandidates, parseGeminiError } from "./gemini-error.ts";
import { CloneError, createLogger } from "./logger.ts";
import { notifyUser } from "./notify.ts";

const log = createLogger("gemini");

// --- Rate-limit retry layer (backlog #1, approved plan) ----------------
// Backoff 2/4/8/16/32s + jitter, server retryDelay respected when short,
// daily-quota 429 fails fast. User toggle: storage.local `geminiAutoRetry`
// (default ON), switchable in the popup.
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
  opts?: { silentDailyQuota?: boolean }
): Promise<T> {
  const enabled = await geminiAutoRetryEnabled();
  let retries = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      const info = parseGeminiError(e);
      const giveUp =
        !enabled || !info.retryable || retries >= RETRY_DELAYS_S.length;
      if (giveUp) {
        // With silentDailyQuota, a caller-level model fallback owns the
        // notification — a "stopped" toast here would be wrong.
        const notifyFinal =
          (info.status === 429 || info.dailyQuota) &&
          !(info.dailyQuota && opts?.silentDailyQuota);
        if (notifyFinal) {
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
      let delayS = (RETRY_DELAYS_S[retries] as number) + Math.random();
      if (info.retryDelaySeconds !== undefined) {
        if (info.retryDelaySeconds > MAX_SERVER_DELAY_S) {
          notifyUser(
            `${info.summary} — server yêu cầu chờ ${formatDuration(info.retryDelaySeconds)}, không tự retry.`,
            "error",
            15000
          );
          throw e;
        }
        delayS = Math.max(delayS, Math.ceil(info.retryDelaySeconds));
      }
      retries++;
      log.warn(label, `${info.summary} — retry ${retries}/${RETRY_DELAYS_S.length} sau ${delayS.toFixed(1)}s`);
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

/**
 * 1:1 of `jz` — fetch answer from Gemini with storage key.
 * Extension over the prototype: free-tier daily quotas are per-model,
 * so when the selected model's daily quota is exhausted the call falls
 * back through modelCandidates() (with a user-visible toast) instead of
 * killing the whole run. Surfaced errors use the friendly summary from
 * parseGeminiError, not the raw API JSON.
 */
export async function fetchGeminiAnswer(req: GeminiRequest): Promise<string> {
  log.info("jz", "Fetching answer from Gemini for question:", {
    preview: req.question.slice(0, 200)
  });
  const stored = await chrome.storage.local.get(["geminiAPI", "model"]);
  const apiKey = stored?.geminiAPI as string | undefined;
  if (!apiKey) {
    throw new CloneError("Gemini API key is missing in storage.", {
      module: "gemini",
      step: "key"
    });
  }
  const primary = (stored?.model as string | undefined) ?? DEFAULT_MODEL;
  const candidates = modelCandidates(primary);
  const ai = new GoogleGenAI({ apiKey });
  let lastErr: unknown;
  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i] as string;
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
        { silentDailyQuota: true }
      );
      const text = res.text ?? "";
      if (!text) {
        throw new CloneError("No answer received", {
          module: "gemini",
          step: "generateContent",
          model
        });
      }
      log.info("jz", `answer received len=${text.length}`, { model });
      return text;
    } catch (e) {
      if (e instanceof CloneError) throw e;
      lastErr = e;
      const info = parseGeminiError(e);
      log.error("jz", "Gemini API Error:", { model, error: (e as Error).message });
      if (!info.dailyQuota) {
        throw new CloneError(
          info.status === 429
            ? info.summary
            : `Gemini API call failed: ${(e as Error).message}`,
          {
            module: "gemini",
            step: "generateContent",
            model,
            raw: (e as Error).message.slice(0, 300)
          }
        );
      }
      const next = candidates[i + 1];
      if (next) {
        log.warn("jz", `model ${model} daily quota exhausted — falling back to ${next}`);
        notifyUser(
          `Model ${model} đã hết quota ngày — chuyển sang ${next}…`,
          "warn",
          9000
        );
      }
    }
  }
  const info = parseGeminiError(lastErr);
  throw new CloneError(
    `Tất cả model đều đã hết quota ngày (đã thử: ${candidates.join(", ")}). ${info.summary}`,
    { module: "gemini", step: "generateContent", models: candidates }
  );
}
