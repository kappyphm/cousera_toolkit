// Peer review (_D/Pd) end-to-end against the real saved review page
// (current Coursera UI). Guards the issue-#28 selector repairs: if the
// review markup changes again, this fails before users notice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFixture, tick } from "./helpers.mjs";
import { handleReview } from "../src/content/auto-peer-review.ts";

test("handleReview grades the open review: spread rule, feedback, submit", async () => {
  const dom = loadFixture(
    "Submit_Your_Topic_and_Research_Questions___Coursera.html",
    // The /review/ segment must be followed by more path — _D's loop
    // check is includes("/review/"), like the prototype.
    "https://www.coursera.org/learn/introduction-to-research-for-essay-writing/peer/abc123/review/xyz"
  );
  const doc = dom.window.document;
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};

  const clicks = [];
  const origClick = dom.window.HTMLElement.prototype.click;
  dom.window.HTMLElement.prototype.click = function () {
    clicks.push(this);
    return origClick.call(this);
  };
  const inserts = [];
  doc.execCommand = (cmd, _ui, arg) => {
    inserts.push({ cmd, arg, active: doc.activeElement });
    if (doc.activeElement?.tagName === "TEXTAREA") doc.activeElement.value += arg;
    return true;
  };

  await handleReview();
  await tick(1000); // Pd's submit lands on a +700ms timer

  // Spread rule: both rubric groups are 2/1/0 and 2/0/0 -> spread 2 > 1
  // -> the LAST option of each group. _D runs Pd twice on a static page
  // (the /review/ loop + the left-to-complete loop), so 4 clicks total.
  const groups = [...doc.querySelectorAll('[role="radiogroup"]')];
  assert.equal(groups.length, 2);
  const lastOptions = groups.map((g) => {
    const x = g.querySelectorAll(".option-contents > div:nth-child(1)");
    return x[x.length - 1];
  });
  const optionClicks = clicks.filter((el) => el.matches(".option-contents > div:nth-child(1)"));
  assert.equal(optionClicks.length, 4);
  assert.ok(optionClicks.every((el) => lastOptions.includes(el)), "every pick is the last option");

  // Feedback: insertText fires with focus inside the wrapper's textarea.
  assert.ok(inserts.length >= 1);
  assert.ok(inserts.every((i) => i.cmd === "insertText" && i.arg === "Good "));
  assert.ok(
    inserts.every(
      (i) =>
        i.active?.tagName === "TEXTAREA" &&
        i.active.closest('[data-testid="peer-review-multi-line-input-field"]')
    )
  );
  const ta = doc.querySelector('[data-testid="peer-review-multi-line-input-field"] textarea');
  assert.ok((ta?.value ?? "").includes("Good "));

  // Submit: the CDS "Submit Review" button (text fallback finder).
  const submitBtn = [...doc.querySelectorAll("button")].find(
    (b) => (b.textContent || "").trim() === "Submit Review"
  );
  assert.ok(submitBtn && clicks.includes(submitBtn), "Submit Review was clicked");
});
