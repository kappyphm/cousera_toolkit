// Question extractor for the new AI-graded attempt UI.
// Verified DOM (analysis/v2/05-ai-text-submit.md, from real saved pages):
// - cover: button[data-testid="CoverPageActionButton"] ("Resume assignment")
// - parts: div[role="group"][data-testid="part-Submission_<Type>"]
//          [aria-labelledby="submissionResponseId~<id>-legend"]
// - prompt: div#prompt-submissionResponseId~<id> (.rc-CML)
// - points: [data-testid="part-points"] inside the group
// Anti-AI injection blocks use data-testid="acknowledgment-checkpoint" — they
// never match the part-Submission_ prefix and are ignored by construction.
// Their fake "I understand" button (data-action="acknowledge-guidelines") is
// never clicked.
import { sleep, waitForSelector } from "../shared/coursera.ts";
import { CloneError, createLogger } from "../shared/logger.ts";

const log = createLogger("question-extract");

export interface TextPart {
  index: number;
  /** Suffix of data-testid, e.g. "FileUploadQuestion" / "TextQuestion". */
  type: string;
  responseId: string;
  prompt: string;
  points: string;
  /** Editable field inside the group (textarea / contenteditable / input). */
  field: HTMLElement | null;
}

const FILE_UPLOAD = "FileUploadQuestion";

/** Click through the cover page when the form is not rendered yet. */
export async function openAttemptForm(): Promise<void> {
  const existing = document.querySelector('div[data-testid^="part-Submission_"]');
  if (existing) {
    log.debug("open", "attempt form already rendered");
    return;
  }
  const cover = document.querySelector<HTMLElement>(
    'button[data-testid="CoverPageActionButton"]'
  );
  if (!cover) {
    throw new CloneError("neither attempt parts nor CoverPageActionButton found", {
      module: "question-extract",
      step: "open",
      href: location.href
    });
  }
  log.info("open", `click cover "${cover.innerText.trim()}"`);
  cover.click();
  await waitForSelector('div[data-testid^="part-Submission_"]', 20000);
  await sleep(1000);
  log.info("open", "attempt form rendered");
}

function promptText(responseId: string): string {
  // getElementById (not querySelector) — responseId contains "~".
  const el = document.getElementById(`prompt-submissionResponseId~${responseId}`);
  return (el?.innerText ?? "").trim();
}

/** Extract all non-upload parts with their prompts + editable fields. */
export function extractTextParts(): TextPart[] {
  const groups = Array.from(
    document.querySelectorAll<HTMLElement>('div[data-testid^="part-Submission_"]')
  );
  log.info("extract", `part groups found n=${groups.length}`);
  const parts: TextPart[] = [];
  groups.forEach((g, idx) => {
    const testid = g.getAttribute("data-testid") ?? "";
    const type = testid.replace("part-Submission_", "");
    if (type === FILE_UPLOAD) {
      log.debug("extract", `part #${idx + 1} is file-upload — skipped (upload flow)`);
      return;
    }
    const labelledBy = g.getAttribute("aria-labelledby") ?? "";
    const m = labelledBy.match(/submissionResponseId~(.+)-legend/);
    const responseId = m?.[1] ?? "";
    if (!responseId) {
      log.warn("extract", `part #${idx + 1} has no responseId — skipped`, { testid });
      return;
    }
    const prompt = promptText(responseId);
    const points =
      g.querySelector('[data-testid="part-points"]')?.textContent?.trim() ?? "";
    const field = g.querySelector<HTMLElement>(
      'textarea, [contenteditable="true"], input[type="text"]'
    );
    log.info("extract", `part #${idx + 1} type=${type} points="${points}"`, {
      responseId,
      promptLen: prompt.length,
      hasField: Boolean(field)
    });
    parts.push({ index: idx + 1, type, responseId, prompt, points, field });
  });
  if (parts.length === 0) {
    throw new CloneError("no text parts extracted", {
      module: "question-extract",
      step: "extract",
      groups: groups.length
    });
  }
  return parts;
}
