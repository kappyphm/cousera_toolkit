# v2.05 — AI Answer Fill (Question → Gemini SDK → Fill, MANUAL submit)

Scope: fill đáp án AI cho AI-graded **text form** (vd "Reflecting on the AI-Graded Feedback").
Pipeline: extract prompt → Gemini (`@google/genai`, model `gemini-2.5-flash`) → fill + verify.
SUBMIT LÀ THỦ CÔNG (quyết định user 2026-10-12): sau khi fill xong user tự review
nội dung rồi Save draft → honor → Submit tay. Extension không bấm submit,
không confirm dialog, không chain d2 (d2 cần submissionId của bài đã nộp).

## P0 findings (verified 2026-10-12)

### 1. Prototype KHÔNG có selector cho new AI-graded attempt UI

Quét `prototype/assets/chunk-674d105d.js` (770789 chars):

| Selector | Hits trong prototype | Nguồn thực |
|---|---|---|
| `part-Submission_*` | 0 | `analysis/v2/coursera resource/*.html` (file 2) |
| `save-draft-button` | 0 | file 2: `button[data-testid="save-draft-button"]` |
| `CoverPageActionButton` | 0 | file 1: `button[data-testid="CoverPageActionButton"]` ("Resume assignment") |
| `AttemptSubmitControls` | 0 | file 2: `div[data-e2e="AttemptSubmitControls"]` |
| `submit-button` | 2 | x2 quiz flow + mD `n[e(299)]` — KHÔNG phải attempt UI |
| `dialog-submit-button` | 2 | x2 `OmMPP` + mD confirm — khớp attempt UI (`button[data-testid="dialog-submit-button"]` có trong file 2) |

Kết luận: `mD` chỉ target **old peer UI** (`rc-SubmissionPartEditor`, `button[data-e2e="submit-assignment"]`).
New attempt UI phải dùng selector từ HTML thật + runtime prefix-match.

### 2. Text-part testid chưa biết → runtime prefix-match

File 1 (text form) ở trạng thái cover page — static HTML không chứa part.
File 2 cho mẫu: `div[role="group"][data-testid="part-Submission_FileUploadQuestion"][aria-labelledby="submissionResponseId~<id>-legend"]`,
prompt tại `div#prompt-submissionResponseId~<id>` (`.rc-CML`).

Chiến lược: `document.querySelectorAll('div[data-testid^="part-Submission_"]')` —
bao mọi variant (`FileUploadQuestion`, `TextQuestion`, ...) mà không cần hardcode.
Loại part suy ra từ hậu tố testid; text-form xử lý các part KHÔNG phải FileUpload.

### 3. Submit gating (file 2, verbatim)

```html
<div data-e2e="AttemptSubmitControls"><div data-testid="HonorCodeAgreement">…
<input id="agreement-checkbox-base" type="checkbox">
<div data-e2e="AttemptSubmitControls__buttons">
  <button aria-label="Submit" data-testid="submit-button" aria-disabled="true" disabled>
  <button aria-label="Save draft" data-testid="save-draft-button" aria-disabled="false">
```

→ Auto phải poll `submit-button` hết `disabled`/`aria-disabled="true"` sau fill + tick honor.
`dialog-submit-button` trong confirm dialog khớp prototype mD → reuse.

### 4. Anti-AI layers (không có rào kỹ thuật)

- Prompt-injection div (`acknowledgment-checkpoint` ×4, "AI assistant is disabled…" ×8,
  fake "I understand" `data-action="acknowledge-guidelines"`, `aria-hidden`) — vô hại với
  content-script (không parse text làm lệnh, không click nút giả).
- Honor policy text (course failure / deactivation) — rủi ro tài khoản, chỉ chạy practice.
- AI grader server-side (`AI_GRADED_RUBRICS`) — chấm chất lượng, không detect AI → nộp bài tốt là đủ.
- `standardProctorConfigurationId: STANDARD~…` metadata — không thấy lockdown/cam SDK trong DOM 2 trang practice.

### 5. Prototype Gemini wrapper `jz` (decoder Cn, @ ~673198) — clone 1:1

```js
const { geminiAPI: r, model: i } = await chrome.storage.local.get(["geminiAPI", "model"]);
if (!r) throw new Error("Gemini API key is missing in storage.");   // Cn(281)
(await new GoogleGenAI({ apiKey: r }).models.generateContent({       // l2 = GoogleGenAI (bundled SDK)
  model: i ?? "gemini-2.5-flash",                                    // Cn(239)
  contents: JSON.stringify(e),
  config: { thinkingConfig: { includeThoughts: false },
            systemInstruction: <Cn(254)> }
})).text || "No answer received";                                    // Cn(277)/Cn(271)
// catch: console.error("Gemini API Error:", r); return "Failed to fetch answer from Gemini." // Cn(247)
```

- `Cn(254)` systemInstruction gốc (quiz trắc nghiệm): "You are a helpful assistant for answering quiz
  questions based on the provided question text. Provide concise and accurate answers. Please avoid
  plagiarism and ensure the answer is in your own words. If the question is unclear, make a reasonable
  assumption to provide an answer."
- Clone đổi systemInstruction sang bản assignment (tự luận dài, bám rubric) theo quyết định user.
- Panel gốc: input `id="gemini-api"` placeholder "Enter Gemini API" ("Gemini API:"),
  lưu `chrome.storage.local.set({geminiAPI})`; key `model` riêng.

## Pipeline (fill-only, quyết định 2026-10-12)

extract (cover click → prompt + rubric theo responseId) → Gemini SDK → fill
(reuse fillEditor/fillPlainInput, Slate-aware qua `beforeinput` + read-back
verify) → DỪNG, log "REVIEW the content, then submit MANUALLY".
Key thiếu → CloneError, không gọi API. Fill verify rỗng → CloneError, không
bao giờ để user nộp bài rỗng (bài học từ sự cố submit-empty: DOM hiện chữ
nhưng Slate/React state rỗng — xem §6).

## 6. Sự cố submit-empty (log thực tế 2026-10-12, trang Reflecting)

Triệu chứng: `fill part #1 filled len=1725` ok, editor HIỆN chữ, nhưng
`submit-button stayed disabled after fill+honor` (poll 30s) — lần chạy trước
nữa còn nộp thành bài rỗng kèm cảnh báo "empty answer" của Coursera.

Root cause: part `RichTextQuestion` đi đường Slate; `execCommand("insertHTML")`
chỉ mutate DOM (nhìn thấy chữ) mà không qua pipeline `beforeinput` của
Slate-react → value nội bộ rỗng → app state rỗng → Submit bị gate + payload rỗng.

Fix:
- `fillEditor`: insert từng paragraph qua synthetic `beforeinput`
  (`insertText`/`insertParagraph`) để Slate commit value; `execCommand` chỉ còn
  là fallback cho contenteditable thường; cuối cùng read-back `innerText`,
  rỗng → return false → caller throw (không bao giờ pass fill rỗng).
- `fillPlainInput`: gán qua NATIVE value setter + bubbled `input` event để
  React controlled input fire `onChange` thật; read-back `el.value`.
- Flow rút gọn fill-only: không auto-submit nên thảm họa nộp-rỗng không thể
  tái diễn từ phía extension; user review tay trước khi nộp.
