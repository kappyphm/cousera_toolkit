// AI answer fill for the new AI-graded attempt UI (v2.05, fill-only).
// Flow: openAttemptForm → extract parts → Gemini per part → fill + verify.
// Two part kinds, one mechanism (user request 2026-10-31): text parts are
// filled in place; file-upload parts get a .txt answer file pushed into
// their uploader (file-upload.ts). Live progress shows on the page via
// the progress panel. Submit is MANUAL (user decision): after the run,
// review the content then Save draft → honor → Submit by hand. This
// module never clicks submit, never confirms dialogs, never chains
// post-submit calls.
import { sleep } from "../shared/coursera.ts";
import { fetchGeminiAnswer, geminiInterRequestDelayMs } from "../shared/gemini.ts";
import { CloneError, createLogger } from "../shared/logger.ts";
import { fillEditor, fillPlainInput } from "./editor-fill.ts";
import { attachAnswerFile } from "./file-upload.ts";
import { progress } from "./progress-ui.ts";
import {
  extractFileParts,
  extractTextParts,
  openAttemptForm,
  type FilePart,
  type TextPart
} from "./question-extract.ts";

const log = createLogger("auto-text-submit");

function buildQuestion(p: Pick<TextPart, "index" | "points" | "prompt" | "type">): string {
  return [
    `Question ${p.index} (${p.points}):`,
    p.prompt,
    p.type ? `(response type: ${p.type})` : ""
  ].join("\n");
}

async function fillPart(p: TextPart, answer: string): Promise<void> {
  const field = p.field;
  if (!field || !field.isConnected) {
    throw new CloneError(`part #${p.index} field missing or detached`, {
      module: "auto-text-submit",
      step: "fill",
      responseId: p.responseId
    });
  }
  const tag = field.tagName.toLowerCase();
  if (tag === "textarea" || (tag === "input" && (field as HTMLInputElement).type === "text")) {
    const input = field as HTMLInputElement | HTMLTextAreaElement;
    await fillPlainInput(input, answer);
    if (input.value.length === 0) {
      throw new CloneError(`part #${p.index} value read-back empty`, {
        module: "auto-text-submit",
        step: "fill-verify",
        responseId: p.responseId
      });
    }
  } else {
    const ok = await fillEditor(field, answer);
    if (!ok) {
      throw new CloneError(`part #${p.index} editor fill failed verification`, {
        module: "auto-text-submit",
        step: "fill-verify",
        responseId: p.responseId
      });
    }
  }
  log.info("fill", `part #${p.index} filled+verified len=${answer.length}`, {
    responseId: p.responseId
  });
}

/**
 * Fill-only run over BOTH part kinds, in page order: text parts are
 * filled in place, file parts receive a .txt answer file. Every step is
 * mirrored to the on-page progress panel. Hands over to the user for
 * manual submit at the end.
 */
export async function handleTextAssignmentSubmit(): Promise<void> {
  log.info("main", "handleTextAssignmentSubmit — start", { href: location.href });
  progress.start("Coursera Toolkit — xử lý bài assignment");
  progress.step("request", "Đã nhận yêu cầu — bắt đầu xử lý bài", "done");
  try {
    progress.step("open", "Đang mở form bài làm…", "active");
    await openAttemptForm();
    progress.step("open", "Đã mở form bài làm", "done");

    const textParts = extractTextParts();
    const fileParts = extractFileParts();
    const total = textParts.length + fileParts.length;
    if (total === 0) {
      throw new CloneError("no parts extracted (neither text nor file-upload)", {
        module: "auto-text-submit",
        step: "extract",
        href: location.href
      });
    }
    progress.step(
      "extract",
      `Đã trích xuất được ${total} phần (${textParts.length} phần viết, ${fileParts.length} phần upload file)`,
      "done"
    );

    type Job = { kind: "text"; part: TextPart } | { kind: "file"; part: FilePart };
    const jobs: Job[] = [
      ...textParts.map((part): Job => ({ kind: "text", part })),
      ...fileParts.map((part): Job => ({ kind: "file", part }))
    ].sort((a, b) => a.part.index - b.part.index);

    let done = 0;
    for (const job of jobs) {
      const n = job.part.index;
      progress.step(`gemini-${n}`, `Đang gửi câu hỏi phần ${n}/${total} cho Gemini…`, "active");
      const answer = await fetchGeminiAnswer({ question: buildQuestion(job.part) });
      progress.step(
        `gemini-${n}`,
        `Đã nhận câu trả lời phần ${n}/${total} từ Gemini (${answer.length} ký tự)`,
        "done"
      );
      if (job.kind === "text") {
        progress.step(`fill-${n}`, `Đang điền đáp án vào phần ${n}/${total}…`, "active");
        await fillPart(job.part, answer);
        progress.step(`fill-${n}`, `Đã điền xong phần ${n}/${total}`, "done");
      } else {
        progress.step(`fill-${n}`, `Đang tạo file .txt và upload cho phần ${n}/${total}…`, "active");
        const fileName = await attachAnswerFile(job.part, answer);
        progress.step(`fill-${n}`, `Đã upload file ${fileName} cho phần ${n}/${total}`, "done");
      }
      done++;
      if (done < jobs.length) {
        // Strictly sequential spacing (user request): the next part's
        // Gemini request fires only after this part is answered AND
        // filled/uploaded, plus a visible pause in between (storage
        // geminiDelaySec, default 10s) so one run never bursts the
        // key's rate limits.
        const delayMs = await geminiInterRequestDelayMs();
        if (delayMs > 0) {
          progress.step(
            `pace-${n}`,
            `Nghỉ ${Math.round(delayMs / 1000)}s để giãn cách trước câu tiếp theo…`,
            "info"
          );
          await sleep(delayMs);
        }
      } else {
        await sleep(500);
      }
    }
    log.info(
      "main",
      `processed ${total} part(s) (${textParts.length} text filled, ${fileParts.length} files uploaded) — REVIEW the content, then submit MANUALLY (Save draft → honor checkbox → Submit)`,
      { total }
    );
    progress.finish(
      `Hoàn tất ${total} phần — hãy kiểm tra lại bài, rồi nộp tay: Save draft → tick honor code → Submit`
    );
  } catch (err) {
    progress.fail(`Lỗi: ${(err as Error).message}`);
    log.error("main", "Error filling assignment:", {
      error: (err as Error).message
    });
    throw new CloneError(`handleTextAssignmentSubmit failed: ${(err as Error).message}`, {
      module: "auto-text-submit",
      step: "main",
      href: location.href
    });
  }
}
