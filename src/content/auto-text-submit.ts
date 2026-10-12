// AI text submit for the new AI-graded attempt UI (v2.05).
// Flow: openAttemptForm → extractTextParts → Gemini per part → fill →
// save draft → honor → poll submit enabled → submit → confirm → chain d2()
// when the page discloses AI Grading. Every step logs; failures throw
// CloneError (never fill garbage, never click a disabled submit).
import { sleep, waitForSelector } from "../shared/coursera.ts";
import { fetchGeminiAnswer } from "../shared/gemini.ts";
import { CloneError, createLogger } from "../shared/logger.ts";
import { fillEditor, fillPlainInput } from "./editor-fill.ts";
import { extractTextParts, openAttemptForm, type TextPart } from "./question-extract.ts";
import { hasAiGrading } from "./auto-submit-assignment.ts";
import { requestGradingByPeer } from "./request-grading-by-peer.ts";

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
    await fillPlainInput(field as HTMLInputElement | HTMLTextAreaElement, answer);
  } else {
    const ok = await fillEditor(field, answer);
    if (!ok) {
      throw new CloneError(`part #${p.index} editor fill failed`, {
        module: "auto-text-submit",
        step: "fill",
        responseId: p.responseId
      });
    }
  }
  log.info("fill", `part #${p.index} filled len=${answer.length}`, {
    responseId: p.responseId
  });
}

async function submitEnabled(btn: HTMLElement): Promise<boolean> {
  if (btn.hasAttribute("disabled")) return false;
  if (btn.getAttribute("aria-disabled") === "true") return false;
  return true;
}

/** 1:1 intent of mD steps 8-9, adapted to AttemptSubmitControls gating. */
async function saveHonorSubmit(): Promise<void> {
  await waitForSelector<HTMLElement>('button[data-testid="save-draft-button"]', 10000)
    .then((b) => {
      log.info("submit", "click save draft");
      b.click();
    })
    .catch(() => log.warn("submit", "save-draft-button not found — skipping"));
  await sleep(1500);

  await waitForSelector<HTMLElement>(
    'input[type="checkbox"]#agreement-checkbox-base, input[type="checkbox"]',
    10000
  )
    .then((box) => {
      const input = box as HTMLInputElement;
      if (!input.checked) {
        log.info("submit", "tick honor checkbox");
        input.click();
      } else {
        log.debug("submit", "honor checkbox already checked");
      }
    })
    .catch(() => log.warn("submit", "honor checkbox not found — skipping"));
  await sleep(1000);

  // Poll until the submit button is enabled (gated on content + honor).
  const btn = await waitForSelector<HTMLElement>(
    'button[data-testid="submit-button"]',
    10000
  );
  const deadline = Date.now() + 30000;
  for (;;) {
    if (await submitEnabled(btn)) break;
    if (Date.now() > deadline) {
      throw new CloneError("submit-button stayed disabled after fill+honor", {
        module: "auto-text-submit",
        step: "poll-submit",
        ariaDisabled: btn.getAttribute("aria-disabled"),
        hasDisabledAttr: btn.hasAttribute("disabled")
      });
    }
    await sleep(1000);
  }
  log.info("submit", "click submit");
  btn.click();
  await sleep(2000);

  await waitForSelector<HTMLElement>(
    'button[data-e2e="dialog-submit"], button[data-track-component="submit_confirm"], button[data-testid="dialog-submit-button"]',
    10000
  )
    .then((b) => {
      log.info("submit", "click confirm dialog");
      b.click();
    })
    .catch(() => log.warn("submit", "confirm dialog not found — skipping"));
  await sleep(2000);
}

/** Full AI text-submit run for the current assignment page. */
export async function handleTextAssignmentSubmit(): Promise<void> {
  log.info("main", "handleTextAssignmentSubmit — start", { href: location.href });
  try {
    await openAttemptForm();
    const parts = extractTextParts();
    for (const p of parts) {
      const answer = await fetchGeminiAnswer({ question: buildQuestion(p) });
      await fillPart(p, answer);
      await sleep(500);
    }
    await saveHonorSubmit();

    if (await hasAiGrading()) {
      log.info("main", "AI Grading disclosed — chaining requestGradingByPeer");
      try {
        await requestGradingByPeer();
      } catch (e) {
        log.error("main", "requestGradingByPeer failed after submit", {
          error: (e as Error).message
        });
      }
    } else {
      log.info("main", "no AI Grading disclosure — skipping requestGradingByPeer");
    }
    log.info("main", "handleTextAssignmentSubmit — done");
  } catch (err) {
    log.error("main", "Error handling text assignment submit:", {
      error: (err as Error).message
    });
    throw new CloneError(`handleTextAssignmentSubmit failed: ${(err as Error).message}`, {
      module: "auto-text-submit",
      step: "main",
      href: location.href
    });
  }
}
