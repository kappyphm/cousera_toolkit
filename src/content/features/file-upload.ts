// File-part handling for the new AI-graded attempt UI (user request
// 2026-10-31): the Gemini answer becomes a .txt file pushed into the
// part's Uppy uploader. Attachment mechanism follows the prototype's
// mD step 7 (click uploader button -> DataTransfer -> change event),
// but the content is a real Gemini answer, not Ut(100) random words,
// and the result is VERIFIED in the UI before returning.
import { sleep } from "../../platform/coursera-dom.ts";
import { CloneError, createLogger } from "../../platform/logger.ts";
import type { FilePart } from "./question-extract.ts";

const log = createLogger("file-upload");

export function answerFileName(partIndex: number): string {
  return `answer_part_${partIndex}.txt`;
}

/** Uppy injects its <input type="file"> only after the button click. */
async function waitForFileInput(
  container: HTMLElement,
  timeoutMs = 10000
): Promise<HTMLInputElement> {
  const t0 = Date.now();
  for (;;) {
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]') ??
      document.querySelector<HTMLInputElement>('input[type="file"]');
    if (input) return input;
    if (Date.now() - t0 > timeoutMs) {
      throw new CloneError("file input did not appear after clicking uploader button", {
        module: "file-upload",
        step: "wait-input"
      });
    }
    await sleep(300);
  }
}

/**
 * The uploader renders the file name inside the part once Uppy accepts
 * it (and starts uploading to Coursera storage). Poll for the name.
 */
async function waitForFileListed(
  container: HTMLElement,
  fileName: string,
  timeoutMs = 30000
): Promise<boolean> {
  const t0 = Date.now();
  for (;;) {
    if ((container.textContent ?? "").includes(fileName)) return true;
    if (Date.now() - t0 > timeoutMs) return false;
    await sleep(500);
  }
}

/**
 * Create the .txt answer file and attach it to the part's uploader.
 * Returns the file name. Throws CloneError when the uploader UI does
 * not confirm the file — never pretend success (v2.05 lesson).
 */
export async function attachAnswerFile(part: FilePart, content: string): Promise<string> {
  const fileName = answerFileName(part.index);
  const btn = part.container.querySelector<HTMLElement>(".rc-UppyFileUploader button");
  if (!btn) {
    throw new CloneError(`part #${part.index} uploader button (.rc-UppyFileUploader) not found`, {
      module: "file-upload",
      step: "find-button",
      responseId: part.responseId
    });
  }
  log.info("upload", `part #${part.index} — clicking uploader, attaching ${fileName}`, {
    responseId: part.responseId,
    contentLen: content.length
  });
  btn.click();
  const input = await waitForFileInput(part.container);
  const file = new File([content], fileName, { type: "text/plain" });
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  const listed = await waitForFileListed(part.container, fileName);
  if (!listed) {
    throw new CloneError(
      `part #${part.index} upload not confirmed — ${fileName} did not appear in the uploader within 30s`,
      { module: "file-upload", step: "verify", responseId: part.responseId }
    );
  }
  log.info("upload", `part #${part.index} — ${fileName} listed in uploader (upload in progress)`);
  return fileName;
}
