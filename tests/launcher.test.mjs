// Course-page launcher (issue #50): href classification, button
// injection, the pending-run driver, the disable-AI two-tap arm, and
// the review chain's stage hops — all against synthetic DOMs with
// fake dispatch/storage/navigate injected.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createDom, tick } from "./helpers.mjs";
import { classifyItemHref, createLauncher } from "../src/content/launcher.ts";

const HOME = "https://www.coursera.org/learn/c1/home/week-1";
const QUIZ_URL = "https://www.coursera.org/learn/c1/quiz/Q1/intro-quiz";
const PEER_URL = "https://www.coursera.org/learn/c1/peer/P1/my-peer";

function fakeDeps(overrides = {}) {
  const state = { pending: null, dispatched: [], navigated: [] };
  const deps = {
    dispatch: async (a) => {
      state.dispatched.push(a);
    },
    storage: {
      async get() {
        return state.pending;
      },
      async set(p) {
        state.pending = p;
      },
      async clear() {
        state.pending = null;
      }
    },
    navigate: (h) => {
      state.navigated.push(h);
    },
    tickMs: 25,
    settleMs: 10,
    hopTimeoutMs: 300,
    armMs: 2000,
    pendingTtlMs: 1200,
    ...overrides
  };
  return { deps, state };
}

const pending = (action, itemBase, stage) => ({
  action,
  itemBase,
  stage,
  stageEnteredAt: Date.now(),
  expiresAt: Date.now() + 60000
});

test("classifyItemHref: types + itemBase; rejects lectures and sub-pages", () => {
  assert.deepEqual(classifyItemHref(QUIZ_URL), { type: "quiz", itemBase: "/learn/c1/quiz/Q1" });
  assert.deepEqual(classifyItemHref(PEER_URL), { type: "peer", itemBase: "/learn/c1/peer/P1" });
  assert.deepEqual(classifyItemHref("https://www.coursera.org/learn/c1/assignment/A1/hw"), {
    type: "assignment",
    itemBase: "/learn/c1/assignment/A1"
  });
  assert.equal(classifyItemHref("https://www.coursera.org/learn/c1/lecture/L1/vid"), null);
  assert.equal(classifyItemHref("https://www.coursera.org/learn/c1/peer/P1/give-feedback"), null);
  assert.equal(classifyItemHref("https://www.coursera.org/learn/c1/peer/P1/review/xyz"), null);
  assert.equal(classifyItemHref("https://example.com/learn/c1/quiz/Q1"), null);
  assert.equal(classifyItemHref("not a url"), null);
});

const OUTLINE = `<!doctype html><html><body>
  <div><a href="${QUIZ_URL}">Quiz 1</a></div>
  <div><a href="${PEER_URL}">Peer 1</a></div>
  <div><a href="https://www.coursera.org/learn/c1/assignment/A1/hw">HW</a></div>
  <div><a href="https://www.coursera.org/learn/c1/lecture/L1/vid">Video</a></div>
</body></html>`;

test("injection: right buttons per type, none for lectures, no duplicates on rescan", () => {
  createDom(OUTLINE, HOME);
  const { deps } = fakeDeps();
  const launcher = createLauncher(deps);
  launcher.start();
  const byAction = (a) => document.querySelectorAll(`button[data-clone-action="${a}"]`).length;
  assert.equal(byAction("auto-quiz"), 1);
  assert.equal(byAction("submit-text-assignment"), 1);
  assert.equal(byAction("submit-assignment"), 1);
  assert.equal(byAction("request-grading-by-peer"), 1);
  assert.equal(byAction("review-peers"), 1);
  assert.equal(document.querySelectorAll("button[data-clone-action]").length, 5);
  launcher.scan();
  launcher.scan();
  assert.equal(document.querySelectorAll("button[data-clone-action]").length, 5);
  launcher.stop();
});

test("click quiz from the outline: pending run set + navigation to the item", async () => {
  createDom(OUTLINE, HOME);
  const { deps, state } = fakeDeps();
  const l = createLauncher(deps);
  l.start();
  document.querySelector('button[data-clone-action="auto-quiz"]').click();
  await tick(60);
  assert.equal(state.pending?.action, "auto-quiz");
  assert.equal(state.pending?.stage, "final");
  assert.equal(state.pending?.itemBase, "/learn/c1/quiz/Q1");
  assert.deepEqual(state.navigated, [QUIZ_URL]);
  l.stop();
});

test("driver: pending final run dispatches once on the item page and clears", async () => {
  createDom(`<!doctype html><html><body><p>quiz page</p></body></html>`, QUIZ_URL);
  const { deps, state } = fakeDeps();
  state.pending = pending("auto-quiz", "/learn/c1/quiz/Q1", "final");
  const l = createLauncher(deps);
  l.start();
  await tick(300);
  assert.deepEqual(state.dispatched, ["auto-quiz"]);
  assert.equal(state.pending, null);
  l.stop();
});

test("driver: expired pending run is dropped without dispatching", async () => {
  createDom(`<!doctype html><html><body></body></html>`, QUIZ_URL);
  const { deps, state } = fakeDeps();
  state.pending = { ...pending("auto-quiz", "/learn/c1/quiz/Q1", "final"), expiresAt: Date.now() - 1 };
  const l = createLauncher(deps);
  l.start();
  await tick(200);
  assert.deepEqual(state.dispatched, []);
  assert.equal(state.pending, null);
  l.stop();
});

test("disable-AI button: first tap only arms, second tap starts the run", async () => {
  createDom(OUTLINE, HOME);
  const { deps, state } = fakeDeps();
  const l = createLauncher(deps);
  l.start();
  const btn = document.querySelector('button[data-clone-action="request-grading-by-peer"]');
  btn.click();
  await tick(60);
  assert.equal(state.pending, null);
  assert.match(btn.textContent, /Chắc chắn/);
  btn.click();
  await tick(60);
  assert.equal(state.pending?.action, "request-grading-by-peer");
  assert.deepEqual(state.navigated, [PEER_URL]);
  l.stop();
});

test("review chain: item stage clicks the page's give-feedback link -> hub", async () => {
  createDom(
    `<!doctype html><html><body><a id="gf" href="https://www.coursera.org/learn/c1/peer/P1/give-feedback">Give feedback</a></body></html>`,
    "https://www.coursera.org/learn/c1/peer/P1/submit"
  );
  const { deps, state } = fakeDeps();
  state.pending = pending("review-peers", "/learn/c1/peer/P1", "item");
  let gfClicks = 0;
  document.getElementById("gf").addEventListener("click", (e) => {
    e.preventDefault();
    gfClicks++;
  });
  const l = createLauncher(deps);
  l.start();
  await tick(300);
  assert.ok(gfClicks >= 1);
  assert.equal(state.pending?.stage, "hub");
  l.stop();
});

test("review chain: hub stage clicks Start Reviewing -> review", async () => {
  createDom(
    `<!doctype html><html><body><p>3 left to complete</p><button id="sr">Start Reviewing</button></body></html>`,
    "https://www.coursera.org/learn/c1/peer/P1/give-feedback"
  );
  const { deps, state } = fakeDeps();
  state.pending = pending("review-peers", "/learn/c1/peer/P1", "hub");
  let srClicks = 0;
  document.getElementById("sr").addEventListener("click", () => srClicks++);
  const l = createLauncher(deps);
  l.start();
  await tick(300);
  assert.equal(srClicks, 1);
  assert.equal(state.pending?.stage, "review");
  l.stop();
});

test("review chain: review stage dispatches review-peers on /review-next", async () => {
  createDom(
    `<!doctype html><html><body><p>review page</p></body></html>`,
    "https://www.coursera.org/learn/c1/peer/P1/review-next"
  );
  const { deps, state } = fakeDeps();
  state.pending = pending("review-peers", "/learn/c1/peer/P1", "review");
  const l = createLauncher(deps);
  l.start();
  await tick(300);
  assert.deepEqual(state.dispatched, ["review-peers"]);
  assert.equal(state.pending, null);
  l.stop();
});

test("review chain: a blocked hub stops the run with no dispatch", async () => {
  createDom(
    `<!doctype html><html><body><p>Submit your project before reviewing classmates.</p></body></html>`,
    "https://www.coursera.org/learn/c1/peer/P1/give-feedback"
  );
  const { deps, state } = fakeDeps();
  state.pending = pending("review-peers", "/learn/c1/peer/P1", "hub");
  const l = createLauncher(deps);
  l.start();
  await tick(300);
  assert.deepEqual(state.dispatched, []);
  assert.equal(state.pending, null);
  l.stop();
});
