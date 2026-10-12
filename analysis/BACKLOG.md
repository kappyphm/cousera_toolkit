# Issue Backlog

## OPEN

### #1 — Gemini 429 rate-limit aborts multi-part fill runs
- **Date:** 2026-10-12 · **Module:** `src/shared/gemini.ts` (`fetchGeminiAnswer`)
- **Symptom:** assignment có nhiều part gọi Gemini dồn dập → 429 RPM → cả run abort.
  Test thực tế 1 câu hỏi pass, không lỗi; chỉ vướng limit khi gọi liên tiếp.
- **Root cause:** gọi 1 lần duy nhất, không retry, không pacing (sleep giữa part chỉ 500ms).
- **Approved plan (chưa triển khai):**
  1. Retry loop ~5 attempts, backoff 2→4→8→16→32s + jitter; chỉ retry 429/500/503/timeout; tôn trọng `Retry-After`/`retryDelay` từ SDK.
  2. Fail fast khi hết quota ngày (`quota` + `per day`/`GenerateRequestsPerDay`) — không retry vô ích, log hướng dẫn đổi key/model hoặc đợi.
  3. Pacing ~3–5s giữa các part trong `auto-text-submit.ts` (hằng số tập trung).
  4. Message lỗi cuối kèm số attempt + gợi ý quota/pacing.
- **Out of scope:** đổi model/SDK, batching phức tạp, key dự phòng.

## DONE

(none yet)
