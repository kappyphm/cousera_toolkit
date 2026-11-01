// Side panel page logic (issue #34) — the toolkit's only UI surface.
// This is a real extension page with its own document: markup lives
// in sidepanel.html, styles in panel.css, and this module only wires
// behavior. It talks to the content scripts through the background
// switchboard: a long-lived port named "panel" carries run commands
// out and log/progress/run-done events back. Gemini settings are
// read/written directly in chrome.storage (same keys as always).

import type { BgToPanel, LogWire } from "../shared/bridge.ts";
import type { ProgressSnapshot } from "../content/progress-ui.ts";

const MAX_LOG_ROWS = 150;
// Matches DEFAULT_MODEL in shared/gemini.ts; duplicated as a literal
// so the panel bundle does not pull in the Gemini SDK just for a
// settings placeholder.
const DEFAULT_MODEL_LABEL = "gemini-2.5-flash";

const STEP_ICONS: Record<string, string> = {
  active: "⏳",
  done: "✅",
  error: "❌",
  info: "ℹ️"
};

let initialized = false;
let port: chrome.runtime.Port | null = null;
let isRunning = false;
let runningLabel = "";

function el<T extends Element>(sel: string): T | null {
  return document.querySelector<T>(sel);
}

function connect(): chrome.runtime.Port {
  if (port) return port;
  port = chrome.runtime.connect({ name: "panel" });
  port.onMessage.addListener((msg: BgToPanel) => onBridgeMessage(msg));
  port.onDisconnect.addListener(() => {
    port = null;
  });
  return port;
}

function onBridgeMessage(msg: BgToPanel): void {
  if (msg.kind === "log") pushLog(msg);
  else if (msg.kind === "progress") renderProgress(msg.snapshot);
  else if (msg.kind === "run-done") finishRun(msg.ok, msg.error);
}

function setStatus(text: string, kind: "idle" | "run" | "ok" | "err"): void {
  const s = el<HTMLElement>("#p-status");
  if (s) s.textContent = text;
  const dot = el<HTMLElement>("#p-dot");
  if (dot) dot.className = `dot${kind === "idle" ? "" : ` ${kind}`}`;
}

function fmtTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function pushLog(ev: LogWire): void {
  const box = el<HTMLElement>("#p-log");
  if (!box) return;
  const row = document.createElement("div");
  row.className = `log-row ${ev.level}`;
  const t = document.createElement("span");
  t.className = "t";
  t.textContent = `${fmtTime(new Date(ev.time))} `;
  const m = document.createElement("span");
  m.className = "m";
  m.textContent = `${ev.module}.${ev.step} `;
  const msg = document.createElement("span");
  msg.className = "msg";
  msg.textContent = ev.message;
  row.append(t, m, msg);
  box.appendChild(row);
  while (box.children.length > MAX_LOG_ROWS) box.firstElementChild?.remove();
  box.scrollTop = box.scrollHeight;
}

function renderProgress(snap: ProgressSnapshot): void {
  const list = el<HTMLUListElement>("#p-steps");
  const empty = el<HTMLElement>("#p-steps-empty");
  if (!list || !empty) return;
  list.replaceChildren();
  empty.style.display = snap.steps.length > 0 ? "none" : "block";
  for (const step of snap.steps) {
    const li = document.createElement("li");
    li.className = step.state;
    li.textContent = `${STEP_ICONS[step.state] ?? ""} ${step.text}`;
    list.appendChild(li);
  }
}

function setButtonsDisabled(disabled: boolean): void {
  document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((b) => {
    b.disabled = disabled;
  });
}

function runFromPanel(action: string, label: string): void {
  if (isRunning) return;
  isRunning = true;
  runningLabel = label;
  setStatus(`Đang chạy: ${label}…`, "run");
  setButtonsDisabled(true);
  try {
    connect().postMessage({ type: "run", action });
  } catch {
    finishRun(false, "Mất kết nối tới background — mở lại panel.");
  }
}

function finishRun(ok: boolean, error?: string): void {
  isRunning = false;
  setButtonsDisabled(false);
  if (ok) setStatus(`Đã xong: ${runningLabel}`, "ok");
  else setStatus(`Lỗi: ${error ?? "không rõ"}`, "err");
}

async function loadSettings(): Promise<void> {
  try {
    const s = await chrome.storage.local.get([
      "geminiAPI",
      "model",
      "isAutoSubmitQuiz",
      "geminiAutoRetry"
    ]);
    const key = el<HTMLInputElement>("#p-key");
    if (key && typeof s?.geminiAPI === "string") key.value = s.geminiAPI;
    const model = el<HTMLInputElement>("#p-model");
    if (model) model.value = typeof s?.model === "string" ? s.model : DEFAULT_MODEL_LABEL;
    const quiz = el<HTMLInputElement>("#p-auto-submit-quiz");
    if (quiz) quiz.checked = s?.isAutoSubmitQuiz === true;
    const retry = el<HTMLInputElement>("#p-retry");
    if (retry) retry.checked = s?.geminiAutoRetry !== false;
  } catch {
    /* storage unavailable — settings stay at defaults */
  }
}

function bindSettings(): void {
  el("#p-save")?.addEventListener("click", () => {
    const geminiAPI = el<HTMLInputElement>("#p-key")?.value ?? "";
    const model = el<HTMLInputElement>("#p-model")?.value ?? "";
    void chrome.storage.local.set({ geminiAPI, model }).then(() => {
      const status = el<HTMLElement>("#p-save-status");
      if (status) {
        status.textContent = "Đã lưu ✓";
        window.setTimeout(() => {
          status.textContent = "";
        }, 2500);
      }
    });
  });
  el("#p-auto-submit-quiz")?.addEventListener("change", (e) => {
    void chrome.storage.local.set({
      isAutoSubmitQuiz: (e.target as HTMLInputElement).checked
    });
  });
  el("#p-retry")?.addEventListener("change", (e) => {
    void chrome.storage.local.set({
      geminiAutoRetry: (e.target as HTMLInputElement).checked
    });
  });
}

/** Wire the panel page once. Safe to call again (no-op). */
export function initPanel(): void {
  if (initialized) return;
  initialized = true;
  document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action as string;
      const label = btn.textContent?.trim() ?? action;
      runFromPanel(action, label);
    });
  });
  el("#p-clear-log")?.addEventListener("click", () => {
    el<HTMLElement>("#p-log")?.replaceChildren();
  });
  bindSettings();
  void loadSettings();
  connect();
}

// Extension pages load this module deferred, so the DOM is ready;
// the guard also keeps test imports side-effect free.
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initPanel());
  } else {
    initPanel();
  }
}
