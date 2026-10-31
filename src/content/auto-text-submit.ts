// AI answer fill for the new AI-graded attempt UI (v2.05, fill-only).
// Flow: openAttemptForm → extractTextParts → Gemini per part → fill + verify.
// Submit is MANUAL (user decision): after the run, review the filled content
// then Save draft → honor → Submit by hand. This module never clicks submit,
// never confirms dialogs, never chains post-submit calls.
import { sleep } from "../shared/coursera.ts";
import { fetchGeminiAnswer } from "../shared/gemini.ts";
import { CloneError, createLogger } from "../shared/logger.ts";
import { fillEditor, fillPlainInput } from "./editor-fill.ts";
import { extractTextParts, openAttemptForm, type TextPart } from "./question-extract.ts";

const log = createLogger("auto-text-submit");

function buildQuestion(p: TextPart): string {
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

/** Fill-only run: Gemini answers into every text part, then hand over to user. */
export async function handleTextAssignmentSubmit(): Promise<void> {
  log.info("main", "handleTextAssignmentSubmit — start", { href: location.href });
  try {
    await openAttemptForm();
    const parts = extractTextParts();
    let idx = 0;
    for (const p of parts) {
      const answer = await fetchGeminiAnswer({ question: buildQuestion(p) });
      await fillPart(p, answer);
      idx++;
      if (idx < parts.length) {
        // Pacing between Gemini calls (backlog #1): a random 3–5s gap
        // between parts so rapid multi-part fills do not trip the
        // per-minute rate limit.
        await sleep(3000 + Math.floor(Math.random() * 2000));
      } else {
        await sleep(500);
      }
    }
    log.info(
      "main",
      `filled ${parts.length} part(s) — REVIEW the content, then submit MANUALLY (Save draft → honor checkbox → Submit)`,
      { parts: parts.length }
    );
  } catch (err) {
    log.error("main", "Error filling text assignment:", {
      error: (err as Error).message
    });
    throw new CloneError(`handleTextAssignmentSubmit failed: ${(err as Error).message}`, {
      module: "auto-text-submit",
      step: "main",
      href: location.href
    });
  }
}
