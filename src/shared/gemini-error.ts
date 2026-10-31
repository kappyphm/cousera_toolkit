// Pure classifier for Gemini API errors — no imports, unit-testable.
// Built for the 429 payload the user hit on 2026-10-31: free-tier DAILY
// quota (GenerateRequestsPerDayPerProjectPerModel-FreeTier, limit 20/day
// for gemini-2.5-flash) carries RetryInfo.retryDelay = 80126s (~22h15m).
// Daily-quota 429s must fail fast (backoff is pointless); per-minute 429s
// and transient 500/503 are worth retrying with backoff.

export interface GeminiErrorInfo {
  /** HTTP status when detectable (from ApiError.status or the payload). */
  status?: number;
  /** Server-provided retry delay in seconds (RetryInfo / prose hint). */
  retryDelaySeconds?: number;
  /** True when the quota window is per-day — retrying now cannot help. */
  dailyQuota: boolean;
  /** True when a backoff retry is reasonable. */
  retryable: boolean;
  /** Short human summary (Vietnamese) for toast + logs. */
  summary: string;
  /** The API's own `error.message`, first line, truncated — for detail. */
  apiMessage?: string;
}

function errorText(e: unknown): string {
  const parts: string[] = [];
  if (e instanceof Error) parts.push(e.message);
  else parts.push(String(e));
  try {
    const j = JSON.stringify(e);
    if (j && j !== "{}") parts.push(j);
  } catch {
    /* unserializable — message text is enough */
  }
  return parts.join(" ");
}

/** Format seconds as 22h15m / 4m05s / 32s for user-facing messages. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m${String(s % 60).padStart(2, "0")}s`;
  return `${s}s`;
}

export function parseGeminiError(e: unknown): GeminiErrorInfo {
  const text = errorText(e);

  let status: number | undefined;
  const statusProp = (e as { status?: unknown } | null)?.status;
  if (typeof statusProp === "number") status = statusProp;
  if (status === undefined) {
    const m = text.match(/"code"\s*:\s*(\d{3})/);
    if (m) status = parseInt(m[1] as string, 10);
  }

  // Retry delay: structured `"retryDelay":"80126s"` first, then the
  // prose form "Please retry in 22h15m26.861723399s." / "retry in 12.5s".
  let retryDelaySeconds: number | undefined;
  const rd = text.match(/"retryDelay"\s*:\s*"([\d.]+)s"/);
  if (rd) {
    retryDelaySeconds = parseFloat(rd[1] as string);
  } else {
    const prose = text.match(/retry in\s+(?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/i);
    if (prose) {
      retryDelaySeconds =
        parseInt(prose[1] ?? "0", 10) * 3600 +
        parseInt(prose[2] ?? "0", 10) * 60 +
        parseFloat(prose[3] as string);
    }
  }

  const dailyQuota = /per day|PerDay/i.test(text);
  const retryable = !dailyQuota && (status === 429 || status === 500 || status === 503);

  // The API's own message: from the JSON payload ("message":"...") when
  // present, first line only, so user-facing errors stay readable.
  let apiMessage: string | undefined;
  const mm = text.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (mm) {
    try {
      apiMessage = JSON.parse(`"${mm[1] as string}"`) as string;
    } catch {
      apiMessage = mm[1] as string;
    }
    apiMessage = apiMessage.split("\n")[0]?.slice(0, 220);
  }

  const summary = dailyQuota
    ? `Gemini đã hết quota ngày (free tier)${
        retryDelaySeconds !== undefined
          ? ` — thử lại sau ~${formatDuration(retryDelaySeconds)}`
          : " — thử lại vào ngày mai"
      }`
    : status === 429
      ? "Gemini bị rate limit (429)"
      : status === 503
        ? "Model Gemini đang quá tải (503 UNAVAILABLE)"
        : status !== undefined
          ? `Gemini API lỗi ${status}`
          : "Gemini API lỗi không rõ";

  return { status, retryDelaySeconds, dailyQuota, retryable, summary, apiMessage };
}

/**
 * Fallback models for daily-quota exhaustion. Free-tier quotas are
 * PER MODEL (GenerateRequestsPerDayPerProjectPerModel), so when one
 * model burns its 20/day, the others still have theirs. Order follows
 * the prototype metadata.json modelList (analysis/v3/01 §4).
 */
export const FALLBACK_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemma-4-31b-it"
] as const;

/** Candidate order: the selected model first, then every fallback. */
export function modelCandidates(primary: string): string[] {
  return [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
}
