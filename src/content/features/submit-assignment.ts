// 1:1 clone of prototype `mD as handlePeerGradedAssignment` @ 738051.
// Origin: prototype/assets/chunk-674d105d.js, analysis/v2/01-auto-submit-assignment.md
// Switch write tab -> fill title/inputs/editors -> Uppy file upload -> honor
// code -> submit -> confirm dialog -> chain requestGradingByPeer() only when
// the page discloses "AI Grading" (prototype hD gate).
import { sleep, waitForSelector } from "../../platform/coursera-dom.ts";
import { findByText } from "../../platform/finder.ts";
import { generateRandomWords } from "../../platform/random.ts";
import { createLogger } from "../../platform/logger.ts";
import { fillEditor, fillPlainInput } from "./editor-fill.ts";
import { requestGradingByPeer } from "./request-peer-grading.ts";

const log = createLogger("submit-assignment");

/** 1:1 of prototype `hD` @ 734205 — true when page discloses AI Grading. */
export async function hasAiGrading(): Promise<boolean> {
  // Current-UI primary signal (issue #32, deliberate deviation from
  // the prototype's sole check): the "Switch to peer grading" button
  // renders ONLY on an AI-graded submission view (observed live
  // 2026-10-31), so its presence is a certain positive. Pre-submission
  // pages don't render it, in which case the prototype's own check
  // below decides exactly as before.
  if (findByText("button", "Switch to peer grading")) {
    log.debug("ai-grading", "AI Grading detected via Switch-to-peer-grading button");
    return true;
  }
  const el = await waitForSelector(".disclosure-header", 1000).catch(() => null);
  const hit = el?.textContent?.includes("AI Grading") ?? false;
  log.debug("ai-grading", `AI Grading disclosure=${hit}`);
  return hit;
}

/** 1:1 of `mD` — submit peer-graded assignment with random placeholder content. */
export async function handlePeerGradedAssignment(): Promise<void> {
  log.info("submit", "handlePeerGradedAssignment — start", { href: location.href });
  try {
    // 1. Switch to the write tab of the submission part editor.
    await waitForSelector<HTMLElement>('div[role="tablist"] button:nth-child(2)')
      .then((btn) => {
        log.info("submit", "click write tab");
        btn.click();
      })
      .catch(() => log.warn("submit", "write tab not found — skipping"));
    await sleep(1000);

    // 2. Title + AI-grading gate (evaluated before fill, used after submit).
    const title = "Help me please! ";
    const aiGrading = await hasAiGrading();

    // 3. Fill title if empty (integrity self-check in prototype is always
    //    true — live branch kept: fill only when empty).
    await waitForSelector('#title, input[aria-label="Title"]', 1000)
      .then(async (el) => {
        const input = el as HTMLInputElement;
        if (!input.value) {
          await sleep(500);
          await fillPlainInput(input, title);
          await sleep(500);
          log.info("submit", "title filled");
        } else {
          log.debug("submit", "title already set — skipping");
        }
      })
      .catch(() => log.warn("submit", "title field not found — skipping"));

    // 4. Plain text inputs — random 3 words.
    const plainInputs = document.querySelectorAll<HTMLInputElement>(
      '#main-container input[type="text"]:not(#title)'
    );
    for (const el of plainInputs) {
      if (!el.value) await fillPlainInput(el, generateRandomWords(3));
    }
    log.info("submit", `plain inputs processed n=${plainInputs.length}`);

    // 5. Textareas — random 3 words.
    const textareas = document.querySelectorAll<HTMLTextAreaElement>("textarea");
    for (const el of textareas) {
      if (!el.value) await fillPlainInput(el, generateRandomWords(3));
    }
    log.info("submit", `textareas processed n=${textareas.length}`);

    // 6. Rich text editors — Slate fill via hx().
    const editors = document.querySelectorAll(
      '.rc-SubmissionPartEditor, .rc-RichTextMLEditor, .rc-CMLEditor'
    );
    const seen = new Set<Element>();
    for (let idx = 0; idx < editors.length; idx++) {
      const ed = editors[idx];
      if (!ed?.isConnected) continue;
      const target = ed.querySelector('[contenteditable="true"]') ?? ed;
      if (target?.isConnected && !seen.has(target)) {
        seen.add(target);
        await fillEditor(target, generateRandomWords(3));
      }
    }
    log.info("submit", `editors processed n=${seen.size}`);

    // 7. File upload — Uppy buttons, random markdown file (prototype verbatim).
    const uppyButtons = document.querySelectorAll<HTMLElement>(".rc-UppyFileUploader button");
    for (const btn of uppyButtons) {
      btn.click();
      await sleep(500);
      const body = generateRandomWords(100);
      const fileName = "session_" + generateRandomWords(10) + ".md";
      const file = new File([body], fileName, { type: "text/markdown" });
      const input = document.querySelector('input[type="file"]');
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        (input as HTMLInputElement).files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        log.info("submit", `file uploaded name=${fileName}`);
      } else {
        log.warn("submit", "input[type=file] not found after uppy click");
      }
      await sleep(2000);
    }
    log.info("submit", `uppy buttons processed n=${uppyButtons.length}`);

    // 8. Honor code + submit + confirm dialog.
    await sleep(2000);
    await waitForSelector<HTMLElement>('input[type="checkbox"], .rc-HonorCodeCheckbox, #agreement-checkbox-base', 1000)
      .then((el) => {
        log.info("submit", "click honor code checkbox");
        el.click();
      })
      .catch(() => log.warn("submit", "honor code checkbox not found — skipping"));
    await waitForSelector<HTMLElement>('button[aria-label="Submit"], button[data-e2e="submit-assignment"]', 2000)
      .then((el) => {
        log.info("submit", "click submit");
        el.click();
      })
      .catch(() => log.warn("submit", "submit button not found — skipping"));
    await sleep(2000);
    await waitForSelector<HTMLElement>(
      'button[data-e2e="dialog-submit"], button[data-track-component="submit_confirm"], button[data-testid="dialog-submit-button"]',
      2000
    )
      .then((el) => {
        log.info("submit", "click confirm dialog");
        el.click();
      })
      .catch(() => log.warn("submit", "confirm dialog button not found — skipping"));
    await sleep(2000);

    // 9. Chain requestGradingByPeer() ONLY when page discloses AI Grading
    //    (prototype: try{r && await d2()}catch{} — r = hD()).
    if (aiGrading) {
      log.info("submit", "AI Grading disclosed — chaining requestGradingByPeer");
      try {
        await requestGradingByPeer();
      } catch (e) {
        // Prototype: empty catch around d2(). Log but do not rethrow —
        // assignment submit already succeeded.
        log.error("submit", "requestGradingByPeer failed after submit", {
          error: (e as Error).message
        });
      }
    } else {
      log.info("submit", "no AI Grading disclosure — skipping requestGradingByPeer");
    }

    log.info("submit", "handlePeerGradedAssignment — done");
  } catch (err) {
    // Prototype: console.error("Error handling peer-graded assignment:", err)
    // — and nothing else: mD does NOT rethrow (parity fix; the caller's
    // toast wrapper surfaces the failure in the prototype).
    log.error("submit", "Error handling peer-graded assignment:", {
      error: (err as Error).message
    });
  }
}
