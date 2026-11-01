// Side panel page (issue #34): the real sidepanel.html wired by
// src/panel/panel.ts against a stubbed chrome (port + storage).
// Guards the whole contract: 7 run commands out, log/progress/run-done
// events in, Gemini settings through the same storage keys.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDom, tick } from "./helpers.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(root, "sidepanel.html"), "utf8");

const store = {
  geminiAPI: "KEY-123",
  model: "gemini-x",
  isAutoSubmitQuiz: true,
  geminiAutoRetry: false
};
const sent = [];
let portHandler = null;
globalThis.chrome = {
  storage: {
    local: {
      get: async (keys) =>
        Object.fromEntries(
          (Array.isArray(keys) ? keys : [keys]).map((k) => [k, store[k]])
        ),
      set: async (obj) => {
        Object.assign(store, obj);
      }
    }
  },
  runtime: {
    connect: () => ({
      postMessage: (m) => sent.push(m),
      onMessage: {
        addListener: (fn) => {
          portHandler = fn;
        }
      },
      onDisconnect: { addListener: () => {} }
    })
  }
};

const { initPanel } = await import("../src/panel/panel.ts");

test("panel: renders, dispatches runs, streams events, saves settings", async () => {
  createDom(html, "chrome-extension://test/sidepanel.html");
  initPanel();
  await tick(10);

  // All seven actions, in the page's group order.
  const actions = [...document.querySelectorAll("[data-action]")].map(
    (b) => b.dataset.action
  );
  assert.deepEqual(actions, [
    "skip-video-reading",
    "skip-discussing",
    "submit-text-assignment",
    "submit-assignment",
    "request-grading-by-peer",
    "review-peers",
    "auto-quiz"
  ]);

  // Settings loaded from storage.
  assert.equal(document.querySelector("#p-key").value, "KEY-123");
  assert.equal(document.querySelector("#p-model").value, "gemini-x");
  assert.equal(document.querySelector("#p-auto-submit-quiz").checked, true);
  assert.equal(document.querySelector("#p-retry").checked, false);

  // A click sends the run command over the port and locks the buttons.
  document.querySelector('[data-action="auto-quiz"]').click();
  assert.deepEqual(sent, [{ type: "run", action: "auto-quiz" }]);
  assert.equal(document.querySelector('[data-action="auto-quiz"]').disabled, true);
  assert.match(document.querySelector("#p-status").textContent, /Đang chạy/);

  // run-done unlocks and reports success.
  portHandler({ kind: "run-done", action: "auto-quiz", ok: true });
  assert.equal(document.querySelector('[data-action="auto-quiz"]').disabled, false);
  assert.match(document.querySelector("#p-status").textContent, /Đã xong/);

  // A failing run surfaces its error.
  document.querySelector('[data-action="review-peers"]').click();
  portHandler({ kind: "run-done", action: "review-peers", ok: false, error: "boom" });
  assert.match(document.querySelector("#p-status").textContent, /Lỗi: boom/);

  // Streamed log events render as rows.
  portHandler({
    kind: "log",
    level: "warn",
    module: "gemini",
    step: "retry",
    message: "thử lại sau 2s",
    time: new Date().toISOString()
  });
  const rows = document.querySelectorAll(".log-row");
  assert.equal(rows.length, 1);
  assert.match(rows[0].textContent, /gemini\.retry/);
  assert.match(rows[0].textContent, /thử lại sau 2s/);

  // Streamed progress renders steps and hides the placeholder.
  portHandler({
    kind: "progress",
    snapshot: {
      title: "t",
      status: "running",
      steps: [{ id: "1", text: "Đã trích xuất câu hỏi", state: "done" }]
    }
  });
  const lis = document.querySelectorAll("#p-steps li");
  assert.equal(lis.length, 1);
  assert.match(lis[0].textContent, /Đã trích xuất câu hỏi/);
  assert.equal(document.querySelector("#p-steps-empty").style.display, "none");

  // Saving writes the same storage keys as the old sidebar did.
  document.querySelector("#p-key").value = "KEY-999";
  document.querySelector("#p-model").value = "gemini-y";
  document.querySelector("#p-save").click();
  await tick(10);
  assert.equal(store.geminiAPI, "KEY-999");
  assert.equal(store.model, "gemini-y");

  // Checkboxes write through on change.
  const quizBox = document.querySelector("#p-auto-submit-quiz");
  quizBox.checked = false;
  quizBox.dispatchEvent(new document.defaultView.Event("change"));
  await tick(10);
  assert.equal(store.isAutoSubmitQuiz, false);

  // Clear-log empties the feed.
  document.querySelector("#p-clear-log").click();
  assert.equal(document.querySelectorAll(".log-row").length, 0);
});
