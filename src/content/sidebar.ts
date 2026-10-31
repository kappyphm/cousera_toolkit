// In-page sidebar (user request 2026-10-31): the toolkit lives inside
// the Coursera page instead of the toolbar popup — a right-hand panel
// that slides in/out, holding every action, the live run progress
// (mirrored from progress-ui), a live log feed (from the logger) and
// the Gemini settings. Shadow DOM keeps Coursera's CSS out and ours
// in. Defensive throughout: a sidebar failure must never break the
// page features, mirroring notify.ts / progress-ui.ts.

import { subscribeLogs, type LogEvent } from "../shared/logger.ts";
import { subscribeProgress, type ProgressSnapshot, type StepState } from "./progress-ui.ts";

/** Runs one toolkit action (wired to main.ts runAction). */
export type SidebarDispatch = (action: string) => Promise<void>;

const HOST_ID = "cousera-toolkit-sidebar-host";
const MAX_LOG_ROWS = 150;

const STEP_ICONS: Record<StepState, string> = {
  active: "⏳",
  done: "✅",
  error: "❌",
  info: "ℹ️"
};

const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .wrap {
    position: fixed; inset: 0; z-index: 2147483645;
    pointer-events: none;
    font-family: "Source Sans Pro", system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #1f1f1f;
  }
  .tab {
    pointer-events: auto;
    position: absolute; right: 0; top: 50%;
    transform: translateY(-50%);
    writing-mode: vertical-rl;
    background: #0056d2; color: #fff;
    border: none; border-radius: 8px 0 0 8px;
    padding: 14px 7px;
    font: 600 12.5px/1 "Source Sans Pro", system-ui, sans-serif;
    letter-spacing: .4px;
    cursor: pointer;
    box-shadow: -2px 2px 10px rgba(0,0,0,.25);
  }
  .tab:hover { background: #0048b0; }
  .tab.hidden { display: none; }
  .panel {
    pointer-events: auto;
    position: absolute; right: 0; top: 0;
    width: 348px; max-width: 92vw; height: 100%;
    background: #fff;
    box-shadow: -6px 0 28px rgba(0,0,0,.22);
    transform: translateX(105%);
    transition: transform .25s ease;
    display: flex; flex-direction: column;
  }
  .panel.open { transform: translateX(0); }
  .header {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 14px 16px 10px;
    border-bottom: 1px solid #e5e7eb;
  }
  .header h1 { margin: 0; font-size: 16.5px; font-weight: 700; color: #0056d2; }
  .header p { margin: 2px 0 0; font-size: 12px; color: #5f6368; }
  .close {
    margin-left: auto; flex: none;
    background: transparent; border: none;
    font-size: 19px; line-height: 1; color: #5f6368;
    cursor: pointer; padding: 2px 4px; border-radius: 6px;
  }
  .close:hover { background: #f1f3f4; color: #1f1f1f; }
  .body { flex: 1; overflow-y: auto; padding: 4px 16px 12px; }
  .section { margin-top: 14px; }
  .section > h2 {
    margin: 0 0 8px;
    font-size: 11px; font-weight: 700;
    letter-spacing: 1.1px; text-transform: uppercase;
    color: #80868b;
    display: flex; align-items: center;
  }
  .section > h2 button {
    margin-left: auto;
    font: 500 11px system-ui, sans-serif;
    letter-spacing: 0; text-transform: none;
    background: none; border: none; color: #0056d2; cursor: pointer; padding: 0;
  }
  .group-label { margin: 10px 0 5px; font-size: 12px; font-weight: 600; color: #3c4043; }
  .group-label:first-of-type { margin-top: 0; }
  .btn {
    display: block; width: 100%;
    margin: 0 0 6px; padding: 8px 10px;
    background: #fff; color: #1f1f1f;
    border: 1px solid #dadce0; border-radius: 8px;
    font: 500 13px system-ui, sans-serif; text-align: left;
    cursor: pointer;
  }
  .btn:hover { border-color: #0056d2; background: #f0f6ff; }
  .btn.primary { background: #0056d2; border-color: #0056d2; color: #fff; font-weight: 600; }
  .btn.primary:hover { background: #0048b0; }
  .btn:disabled { opacity: .55; cursor: wait; }
  .check { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: #3c4043; margin: 4px 0 2px; cursor: pointer; }
  .check input { accent-color: #0056d2; width: 15px; height: 15px; margin: 0; }
  .steps { list-style: none; margin: 0; padding: 0; font-size: 12.5px; }
  .steps li { margin: 4px 0; word-break: break-word; }
  .steps li.error { color: #b3261e; }
  .steps li.active { color: #7a4d00; }
  .empty { font-size: 12.5px; color: #80868b; margin: 0; }
  .log {
    background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 8px;
    padding: 7px 9px; height: 190px; overflow-y: auto;
    font: 11.5px/1.55 ui-monospace, "SF Mono", Consolas, monospace;
  }
  .log-row { word-break: break-word; margin: 1px 0; }
  .log-row .t { color: #80868b; }
  .log-row .m { color: #3c4043; }
  .log-row.warn .msg { color: #7a4d00; }
  .log-row.error { background: #fce8e6; border-radius: 4px; }
  .log-row.error .msg { color: #b3261e; }
  label.field { display: block; font-size: 12.5px; font-weight: 600; color: #3c4043; margin: 8px 0 3px; }
  input.text {
    width: 100%; padding: 7px 9px;
    border: 1px solid #dadce0; border-radius: 8px;
    font: 13px system-ui, sans-serif; color: #1f1f1f; background: #fff;
  }
  input.text:focus { outline: 2px solid #0056d2; outline-offset: 0; border-color: transparent; }
  .save-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
  .save {
    background: #0056d2; color: #fff; border: none; border-radius: 8px;
    padding: 8px 16px; font: 600 13px system-ui, sans-serif; cursor: pointer;
  }
  .save:hover { background: #0048b0; }
  .save-status { font-size: 12.5px; color: #137333; }
  .footer {
    border-top: 1px solid #e5e7eb;
    padding: 9px 16px;
    font-size: 12.5px; color: #3c4043;
    display: flex; gap: 8px; align-items: center;
    min-height: 38px;
  }
  .dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #9aa0a6; }
  .dot.run { background: #f9ab00; }
  .dot.ok { background: #137333; }
  .dot.err { background: #b3261e; }
`;

const SKELETON = `
  <div class="wrap">
    <button class="tab" id="sb-tab" title="Mở Coursera Toolkit">⚙ Toolkit</button>
    <aside class="panel" id="sb-panel" aria-label="Coursera Toolkit">
      <div class="header">
        <div>
          <h1>Coursera Toolkit</h1>
          <p>Công cụ hỗ trợ học tập — chạy ngay trên trang</p>
        </div>
        <button class="close" id="sb-close" title="Đóng (Esc)">×</button>
      </div>
      <div class="body">
        <div class="section">
          <h2>Chức năng</h2>
          <p class="group-label">Học tập</p>
          <button class="btn" data-action="skip-video-reading">⏩ Bỏ qua video / reading</button>
          <button class="btn" data-action="skip-discussing">💬 Làm discussion</button>
          <p class="group-label">Assignment</p>
          <button class="btn primary" data-action="submit-text-assignment">🤖 Fill assignment (Gemini)</button>
          <button class="btn" data-action="submit-assignment">📤 Nộp bài peer (tự động)</button>
          <button class="btn" data-action="request-grading-by-peer">🎓 Xin chấm lại bằng peer</button>
          <button class="btn" data-action="review-peers">📝 Chấm bài peer (tự động)</button>
          <p class="group-label">Quiz</p>
          <button class="btn" data-action="auto-quiz">❓ Trả lời quiz (Gemini)</button>
          <label class="check"><input type="checkbox" id="sb-auto-submit-quiz"> Tự nộp quiz (tắt = chỉ điền)</label>
        </div>
        <div class="section">
          <h2>Tiến trình</h2>
          <p class="empty" id="sb-steps-empty">Chưa có tác vụ nào chạy.</p>
          <ul class="steps" id="sb-steps"></ul>
        </div>
        <div class="section">
          <h2>Nhật ký <button id="sb-clear-log" type="button">Xoá log</button></h2>
          <div class="log" id="sb-log"></div>
        </div>
        <div class="section">
          <h2>Cài đặt Gemini</h2>
          <label class="field" for="sb-key">Gemini API key</label>
          <input class="text" id="sb-key" type="text" placeholder="Dán API key vào đây" autocomplete="off">
          <label class="field" for="sb-model">Model</label>
          <input class="text" id="sb-model" type="text" autocomplete="off">
          <label class="check"><input type="checkbox" id="sb-retry"> Tự retry khi Gemini rate limit (429)</label>
          <div class="save-row">
            <button class="save" id="sb-save" type="button">Lưu cài đặt</button>
            <span class="save-status" id="sb-save-status"></span>
          </div>
        </div>
      </div>
      <div class="footer"><span class="dot" id="sb-dot"></span><span id="sb-status">Sẵn sàng.</span></div>
    </aside>
  </div>
`;

let shadow: ShadowRoot | null = null;
let dispatchRef: SidebarDispatch | null = null;
let isOpen = false;
let isRunning = false;

function qs<T extends Element>(sel: string): T | null {
  return shadow?.querySelector<T>(sel) ?? null;
}

function setOpen(v: boolean): void {
  isOpen = v;
  qs("#sb-panel")?.classList.toggle("open", v);
  qs("#sb-tab")?.classList.toggle("hidden", v);
}

/** Toggle the sidebar (also called from the toolbar icon via message). */
export function toggleSidebar(force?: boolean): void {
  setOpen(force ?? !isOpen);
}

function setStatus(text: string, kind: "idle" | "run" | "ok" | "err"): void {
  const s = qs<HTMLElement>("#sb-status");
  if (s) s.textContent = text;
  const dot = qs<HTMLElement>("#sb-dot");
  if (dot) dot.className = `dot${kind === "idle" ? "" : ` ${kind}`}`;
}

function fmtTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function pushLog(ev: LogEvent): void {
  const box = qs<HTMLElement>("#sb-log");
  if (!box) return;
  const row = document.createElement("div");
  row.className = `log-row ${ev.level}`;
  const t = document.createElement("span");
  t.className = "t";
  t.textContent = `${fmtTime(ev.time)} `;
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
  const list = qs<HTMLUListElement>("#sb-steps");
  const empty = qs<HTMLElement>("#sb-steps-empty");
  if (!list || !empty) return;
  list.replaceChildren();
  empty.style.display = snap.steps.length > 0 ? "none" : "block";
  for (const step of snap.steps) {
    const li = document.createElement("li");
    li.className = step.state;
    li.textContent = `${STEP_ICONS[step.state]} ${step.text}`;
    list.appendChild(li);
  }
}

async function runFromSidebar(action: string, label: string): Promise<void> {
  if (!dispatchRef || isRunning) return;
  isRunning = true;
  setStatus(`Đang chạy: ${label}…`, "run");
  shadow?.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((b) => {
    b.disabled = true;
  });
  try {
    await dispatchRef(action);
    setStatus(`Đã xong: ${label}`, "ok");
  } catch (e) {
    setStatus(`Lỗi: ${(e as Error).message}`, "err");
  } finally {
    isRunning = false;
    shadow?.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((b) => {
      b.disabled = false;
    });
  }
}

async function loadSettings(): Promise<void> {
  try {
    const s = await chrome.storage.local.get([
      "geminiAPI",
      "model",
      "isAutoSubmitQuiz",
      "geminiAutoRetry"
    ]);
    const key = qs<HTMLInputElement>("#sb-key");
    if (key && typeof s?.geminiAPI === "string") key.value = s.geminiAPI;
    const model = qs<HTMLInputElement>("#sb-model");
    if (model) model.value = typeof s?.model === "string" ? s.model : "gemini-2.5-flash";
    const quiz = qs<HTMLInputElement>("#sb-auto-submit-quiz");
    if (quiz) quiz.checked = s?.isAutoSubmitQuiz === true;
    const retry = qs<HTMLInputElement>("#sb-retry");
    if (retry) retry.checked = s?.geminiAutoRetry !== false;
  } catch {
    /* storage unavailable — settings stay at defaults */
  }
}

function bindSettings(): void {
  qs("#sb-save")?.addEventListener("click", () => {
    const geminiAPI = qs<HTMLInputElement>("#sb-key")?.value ?? "";
    const model = qs<HTMLInputElement>("#sb-model")?.value ?? "";
    void chrome.storage.local.set({ geminiAPI, model }).then(() => {
      const el = qs<HTMLElement>("#sb-save-status");
      if (el) {
        el.textContent = "Đã lưu ✓";
        window.setTimeout(() => {
          el.textContent = "";
        }, 2500);
      }
    });
  });
  qs("#sb-auto-submit-quiz")?.addEventListener("change", (e) => {
    void chrome.storage.local.set({
      isAutoSubmitQuiz: (e.target as HTMLInputElement).checked
    });
  });
  qs("#sb-retry")?.addEventListener("change", (e) => {
    void chrome.storage.local.set({
      geminiAutoRetry: (e.target as HTMLInputElement).checked
    });
  });
}

/** Build the sidebar once per page. Never throws. */
export function initSidebar(dispatch: SidebarDispatch): void {
  try {
    if (document.getElementById(HOST_ID)) return;
    dispatchRef = dispatch;
    const host = document.createElement("div");
    host.id = HOST_ID;
    shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    const root = document.createElement("div");
    root.innerHTML = SKELETON;
    shadow.append(style, root);
    document.documentElement.appendChild(host);

    qs("#sb-tab")?.addEventListener("click", () => setOpen(true));
    qs("#sb-close")?.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen) setOpen(false);
    });
    shadow.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action as string;
        const label = btn.textContent?.trim() ?? action;
        void runFromSidebar(action, label);
      });
    });
    qs("#sb-clear-log")?.addEventListener("click", () => {
      const box = qs<HTMLElement>("#sb-log");
      if (box) box.replaceChildren();
    });
    bindSettings();
    void loadSettings();
    subscribeLogs(pushLog);
    subscribeProgress(renderProgress);
  } catch {
    /* the sidebar is decorative — features must work without it */
  }
}
