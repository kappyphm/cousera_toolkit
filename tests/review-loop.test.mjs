// _D §4.4 counter loop (restored verbatim, issue #44) against a
// synthetic /review-next page — the current UI's review URL, where
// §4.3 does not fire (no "/review/" segment) and the whole run is
// driven by [data-testid="review-count"], exactly as the bundle does.
//
// The test pins the bundle's read-then-grade semantics: the counter
// text is read BEFORE each grade, so with "2 left to complete" and a
// counter that flips to "2 complete" after the second submit, the
// loop grades THREE times (the third grade is the bundle's own
// extra pass after the marker disappears) and then exits.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createDom, tick } from "./helpers.mjs";
import { handleReview } from "../src/content/features/peer-review.ts";

const PAGE_URL =
  "https://www.coursera.org/learn/introduction-to-research-for-essay-writing/peer/abc123/review-next";

const formHtml = () => `
  <div role="radiogroup">
    <div class="option-contents"><div class="opt"><label class="peer-option-input"><span class="cds-checkboxAndRadio-label">0 points</span></label></div></div>
    <div class="option-contents"><div class="opt"><label class="peer-option-input"><span class="cds-checkboxAndRadio-label">1 point</span></label></div></div>
  </div>
  <div data-testid="peer-review-multi-line-input-field">\u200b<textarea></textarea></div>
  <button type="button">Submit Review</button>`;

test("§4.4: counter loop grades until the marker text is gone (bundle semantics)", async () => {
  createDom(
    `<!doctype html><html><body>
       <div data-testid="review-count">2 left to complete</div>
       <div id="form-slot">${formHtml()}</div>
     </body></html>`,
    PAGE_URL
  );
  window.HTMLElement.prototype.scrollIntoView = function () {};

  const inserts = [];
  document.execCommand = (cmd, _ui, arg) => {
    inserts.push({ cmd, arg });
    return true;
  };

  let picks = 0;
  let submits = 0;
  let left = 2;
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest?.(".opt")) picks++;
    if (t.tagName === "BUTTON" && (t.textContent || "").trim() === "Submit Review") {
      submits++;
      // Coursera serves the next submission at the same URL and the
      // counter updates; after the last required one it flips text.
      setTimeout(() => {
        left--;
        document.querySelector('[data-testid="review-count"]').textContent =
          left > 0 ? `${left} left to complete` : "2 complete";
        document.getElementById("form-slot").innerHTML = formHtml();
      }, 30);
    }
  });

  await handleReview();
  await tick(100);

  assert.equal(submits, 3, "2 required reviews + the bundle's read-then-grade extra pass");
  assert.equal(picks, 3, "one rubric pick per grade (spread 1 -> first option)");
  assert.equal(inserts.length, 3, "one feedback fill per grade");
  assert.ok(inserts.every((i) => i.cmd === "insertText" && i.arg === "Good "));
});
