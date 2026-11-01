// Auto peer review orchestration (issue #38) against synthetic pages
// built from the LIVE-observed current UI (supervised run, 2026-11-01):
// the hub (/give-feedback) has blocked / ready / complete states, and
// reviews run as a conveyor on /review-next — submitting loads the
// next submission at the same URL and the "N left to complete"
// counter is rendered on the review page itself. Pd's grading core is
// covered by peer-review.test.mjs against the real saved page; here a
// click hook simulates Coursera's submit transition (counter drops,
// form is replaced with a fresh one).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createDom } from "./helpers.mjs";
import {
  handleReview,
  inspectReviewPage,
  readReviewCounter
} from "../src/content/features/peer-review.ts";

const COURSE = "https://www.coursera.org/learn/introduction-to-research-for-essay-writing";
const HUB_URL = `${COURSE}/peer/pAw7G/thesis-statement-for-research-paper/give-feedback`;
const REVIEW_URL = `${COURSE}/peer/pAw7G/thesis-statement-for-research-paper/review-next`;
const ZWSP = "\u200B";

// Mirrors the real option markup (see the saved fixture): the click
// target is .option-contents > div:nth-child(1), the points come from
// the label's text.
function option(points, label, oid) {
  return (
    `<div class="peer-option-input"><label class="cds-checkboxAndRadio-label">` +
    `<span class="cds-checkboxAndRadio-labelText"><div class="option-contents">` +
    `<div data-oid="${oid}"><span>${points} points</span></div><div>${label}</div>` +
    `</div></span></label></div>`
  );
}

// Group 1 spread is 2-0=2 (>1 -> pick LAST), group 2 spread is 1-0=1
// (-> pick FIRST). Same shape on every round, fresh elements.
function reviewForm(round) {
  return (
    `<div id="review-form" data-round="${round}">` +
    `<div role="radiogroup">` +
    option(2, "Both present", `r${round}-g1-o1`) +
    option(1, "Topic only", `r${round}-g1-o2`) +
    option(0, "Neither", `r${round}-g1-o3`) +
    `</div>` +
    `<div role="radiogroup">` +
    option(1, "Yes", `r${round}-g2-o1`) +
    option(0, "No", `r${round}-g2-o2`) +
    `</div>` +
    `<div data-testid="peer-review-multi-line-input-field">${ZWSP}<textarea></textarea></div>` +
    `<button type="button">Submit Review</button>` +
    `</div>`
  );
}

function reviewPage(left, round) {
  return (
    `<div id="hdr"><span>Reviews</span> <span id="counter-text">${left} left to complete</span></div>` +
    `<div id="slot">${reviewForm(round)}</div>`
  );
}

// Install jsdom gaps + a click hook that records clicks and lets the
// test simulate Coursera's reaction to Submit / Start Reviewing.
function instrument(dom, onAction) {
  const doc = dom.window.document;
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  const inserts = [];
  doc.execCommand = (cmd, _ui, arg) => {
    inserts.push({ cmd, arg });
    if (doc.activeElement?.tagName === "TEXTAREA") doc.activeElement.value += arg;
    return true;
  };
  const clicks = [];
  const origClick = dom.window.HTMLElement.prototype.click;
  dom.window.HTMLElement.prototype.click = function () {
    clicks.push(this);
    onAction?.(this);
    return origClick.call(this);
  };
  return { clicks, inserts };
}

const picksOf = (clicks) =>
  clicks.filter((el) => el.dataset?.oid).map((el) => el.dataset.oid);
const submitsOf = (clicks) =>
  clicks.filter((el) => (el.textContent || "").trim() === "Submit Review");

test("counter parser + page-state classification", () => {
  // Tier 1: the prototype's [data-testid="review-count"] anchor.
  let dom = createDom(
    `<div data-testid="review-count">Reviews — 3 left to complete</div>`,
    REVIEW_URL
  );
  assert.equal(readReviewCounter()?.left, 3);
  assert.equal(inspectReviewPage().kind, "review");

  // Tier 2: bare text counter on the hub (no testid anywhere).
  dom = createDom(
    `<div><span>Reviews</span> <span>5 left to complete</span></div>` +
      `<button type="button">Start Reviewing</button>`,
    HUB_URL
  );
  assert.equal(readReviewCounter()?.left, 5);
  const hub = inspectReviewPage();
  assert.equal(hub.kind, "hub");
  assert.equal(hub.counter?.left, 5);

  // Hub, blocked: banner up, no Start Reviewing anywhere.
  dom = createDom(
    `<div>Submit your project before reviewing classmates.</div>` +
      `<a href="#">Go to my project</a>`,
    HUB_URL
  );
  assert.equal(inspectReviewPage().kind, "blocked");

  // Legacy review page: form but no counter -> review, counter null.
  dom = createDom(reviewForm(1), `${COURSE}/peer/abc123/review/xyz`);
  const legacy = inspectReviewPage();
  assert.equal(legacy.kind, "review");
  assert.equal(legacy.counter, null);

  // Unrelated course page.
  dom = createDom(`<p>Course home</p>`, `${COURSE}/home`);
  assert.equal(inspectReviewPage().kind, "other");
});

test("conveyor on /review-next grades exactly the remaining count, then stops", async () => {
  const state = { left: 2, round: 1 };
  const dom = createDom(reviewPage(state.left, state.round), REVIEW_URL);
  const doc = dom.window.document;
  let loadingPicks = 0;
  const { clicks, inserts } = instrument(dom, (el) => {
    if (doc.querySelector("#loading") && el.dataset?.oid) loadingPicks++;
    if ((el.textContent || "").trim() !== "Submit Review") return;
    // Post-submit loading window (issue #40, reported live): the form
    // is torn down immediately; the next submission AND the counter
    // drop only land ~1.2s later. The orchestration must wait this
    // out instead of grading into the loading page.
    doc.querySelector("#slot").innerHTML = `<div id="loading">Loading</div>`;
    setTimeout(() => {
      state.left--;
      state.round++;
      doc.querySelector("#counter-text").textContent = `${state.left} left to complete`;
      doc.querySelector("#slot").innerHTML =
        state.left > 0 ? reviewForm(state.round) : `<div>All caught up</div>`;
    }, 1200);
  });

  await handleReview();

  assert.equal(loadingPicks, 0, "no grading clicks during the loading window");
  assert.equal(submitsOf(clicks).length, 2);
  assert.deepEqual(picksOf(clicks), ["r1-g1-o3", "r1-g2-o1", "r2-g1-o3", "r2-g2-o1"]);
  assert.equal(inserts.length, 2);
  assert.ok(inserts.every((i) => i.cmd === "insertText" && i.arg === "Good "));
});

test("hub entry: Start Reviewing is clicked, the review is graded, loop ends at 0", async () => {
  const state = { left: 1 };
  const dom = createDom(
    `<div><span>Reviews</span> <span>1 left to complete</span></div>` +
      `<p>Give feedback to your peers.</p>` +
      `<button type="button">Start Reviewing</button>`,
    HUB_URL
  );
  const doc = dom.window.document;
  const { clicks } = instrument(dom, (el) => {
    const text = (el.textContent || "").trim();
    if (text === "Start Reviewing") {
      doc.body.innerHTML = reviewPage(state.left, 1);
    } else if (text === "Submit Review") {
      state.left = 0;
      doc.querySelector("#counter-text").textContent = "0 left to complete";
      doc.querySelector("#slot").innerHTML = `<div>All caught up</div>`;
    }
  });

  await handleReview();

  assert.ok(
    clicks.some((el) => (el.textContent || "").trim() === "Start Reviewing"),
    "Start Reviewing was clicked"
  );
  assert.equal(submitsOf(clicks).length, 1);
  assert.deepEqual(picksOf(clicks), ["r1-g1-o3", "r1-g2-o1"]);
});

test("blocked hub: stops immediately, clicks nothing", async () => {
  const dom = createDom(
    `<div>Submit your project before reviewing classmates.</div>` +
      `<a href="#">Go to my project</a>`,
    HUB_URL
  );
  const { clicks } = instrument(dom, null);
  await handleReview();
  assert.equal(clicks.length, 0);
});

test("completed hub: counter at 0 wins over the still-present Start Reviewing", async () => {
  const dom = createDom(
    `<div id="c"><span>Reviews</span><span>3 complete</span></div>` +
      `<p>You've finished your peer reviews</p>` +
      `<button type="button">Start Reviewing</button>`,
    HUB_URL
  );
  const { clicks } = instrument(dom, null);
  const state = inspectReviewPage();
  assert.equal(state.kind, "hub");
  assert.equal(state.counter?.left, 0);
  await handleReview();
  assert.equal(clicks.length, 0);
});
