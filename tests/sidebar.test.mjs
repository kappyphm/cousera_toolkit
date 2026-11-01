// In-page sidebar: Shadow DOM shell, open/close, action dispatch,
// live log + progress mirroring, and Gemini settings persistence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createDom, tick } from "./helpers.mjs";
import { initSidebar, toggleSidebar } from "../src/content/sidebar.ts";
import { createLogger } from "../src/shared/logger.ts";
import { progress } from "../src/content/progress-ui.ts";

test("sidebar renders, dispatches, mirrors log/progress, saves settings", async () => {
  const dom = createDom("<!doctype html><html><body></body></html>", "https://www.coursera.org/learn/x");
  const store = { model: "gemini-3.1-flash-lite", geminiAutoRetry: true };
  globalThis.chrome = {
    storage: {
      local: {
        get: async (keys) => {
          const out = {};
          for (const k of Array.isArray(keys) ? keys : [keys]) if (k in store) out[k] = store[k];
          return out;
        },
        set: async (obj) => {
          Object.assign(store, obj);
        }
      }
    }
  };

  const calls = [];
  initSidebar(async (action) => {
    calls.push(action);
  });
  await tick();

  const host = document.getElementById("cousera-toolkit-sidebar-host");
  assert.ok(host && host.shadowRoot, "host + shadow root exist");
  const sr = host.shadowRoot;
  const panel = sr.querySelector("#sb-panel");
  assert.ok(!panel.classList.contains("open"), "panel starts closed");
  sr.querySelector("#sb-tab").click();
  assert.ok(panel.classList.contains("open"), "tab click opens panel");
  sr.querySelector("#sb-close").click();
  assert.ok(!panel.classList.contains("open"), "close button hides panel");
  toggleSidebar(true);
  assert.ok(panel.classList.contains("open"), "toggleSidebar(true) opens");

  sr.querySelector('[data-action="submit-text-assignment"]').click();
  await tick();
  assert.deepEqual(calls, ["submit-text-assignment"]);
  assert.ok(sr.querySelector("#sb-status").textContent.includes("Đã xong"));

  createLogger("test").error("stepX", "boom message 123");
  await tick();
  const logText = sr.querySelector("#sb-log").textContent;
  assert.ok(logText.includes("boom message 123") && logText.includes("test.stepX"));

  progress.start("Test run");
  progress.step("s1", "Bước một đang chạy", "active");
  progress.step("s1", "Bước một xong", "done");
  await tick();
  const steps = sr.querySelector("#sb-steps");
  assert.equal(steps.children.length, 1);
  assert.ok(steps.textContent.includes("Bước một xong"));

  assert.equal(sr.querySelector("#sb-model").value, "gemini-3.1-flash-lite");
  sr.querySelector("#sb-key").value = "KEY-ABC";
  sr.querySelector("#sb-model").value = "gemini-2.5-flash-lite";
  sr.querySelector("#sb-save").click();
  await tick();
  assert.equal(store.geminiAPI, "KEY-ABC");
  assert.equal(store.model, "gemini-2.5-flash-lite");
  assert.ok(sr.querySelector("#sb-save-status").textContent.includes("Đã lưu"));

  const retry = sr.querySelector("#sb-retry");
  retry.checked = false;
  retry.dispatchEvent(new dom.window.Event("change"));
  await tick();
  assert.equal(store.geminiAutoRetry, false);
});
