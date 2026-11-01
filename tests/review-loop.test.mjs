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

test("§3.1 timeout skips the pass instead of killing the run (issue #46)", async () => {
  // Slow network: the counter renders immediately but the review form
  // only appears at +2600ms — after Pd's first §3.1 wait (1000ms) has
  // already timed out. With the interim softening the run survives:
  // pass 1 is skipped, later passes grade normally.
  createDom(
    `<!doctype html><html><body>
       <div data-testid="review-count">1 left to complete</div>
       <div id="form-slot"></div>
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
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest?.(".opt")) picks++;
    if (t.tagName === "BUTTON" && (t.textContent || "").trim() === "Submit Review") {
      submits++;
      setTimeout(() => {
        document.querySelector('[data-testid="review-count"]').textContent = "1 complete";
        document.getElementById("form-slot").innerHTML = formHtml();
      }, 30);
    }
  });

  // The form finishes rendering long after the first wait gave up.
  setTimeout(() => {
    document.getElementById("form-slot").innerHTML = formHtml();
  }, 2600);

  await handleReview(); // must RESOLVE — a rejection here is the old bug
  await tick(100);

  // Pass 1 skipped (nothing picked/filled/submitted into the void);
  // pass 2 grades the one required review; pass 3 is §4.4's extra
  // read-then-grade pass after the counter flips to "1 complete".
  assert.equal(picks, 2);
  assert.equal(inserts.length, 2);
  assert.equal(submits, 2);
});
