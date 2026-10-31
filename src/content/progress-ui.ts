// On-page progress panel (user request 2026-10-31): live step-by-step
// status in Vietnamese on the Coursera page itself — received request,
// extracted questions, sent to Gemini, answer received, filling /
// uploading, done or failed — instead of console-only logs.
// Defensive like notify.ts: rendering must never break the feature.

export type StepState = "active" | "done" | "error" | "info";

const PANEL_ID = "cousera-toolkit-progress";
const ICONS: Record<StepState, string> = {
  active: "⏳",
  done: "✅",
  error: "❌",
  info: "ℹ️"
};

let panel: HTMLDivElement | null = null;
let listEl: HTMLUListElement | null = null;
let titleEl: HTMLSpanElement | null = null;
const lines = new Map<string, HTMLLIElement>();
let hideTimer: number | undefined;

function ensurePanel(title: string): boolean {
  try {
    if (panel && panel.isConnected) {
      if (titleEl) titleEl.textContent = title;
      return true;
    }
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    Object.assign(panel.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: "2147483646",
      width: "350px",
      maxHeight: "60vh",
      overflowY: "auto",
      background: "rgba(17,24,39,.97)",
      color: "#f9fafb",
      borderRadius: "10px",
      padding: "10px 12px",
      font: "13px/1.5 system-ui, sans-serif",
      boxShadow: "0 6px 24px rgba(0,0,0,.4)"
    });
    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontWeight: "700",
      marginBottom: "6px"
    });
    titleEl = document.createElement("span");
    titleEl.textContent = title;
    const close = document.createElement("button");
    close.textContent = "×";
    close.title = "Đóng";
    Object.assign(close.style, {
      background: "transparent",
      border: "none",
      color: "#f9fafb",
      fontSize: "16px",
      cursor: "pointer",
      lineHeight: "1"
    });
    close.addEventListener("click", () => {
      panel?.remove();
      panel = null;
      lines.clear();
    });
    header.appendChild(titleEl);
    header.appendChild(close);
    listEl = document.createElement("ul");
    Object.assign(listEl.style, { listStyle: "none", margin: "0", padding: "0" });
    panel.appendChild(header);
    panel.appendChild(listEl);
    document.documentElement.appendChild(panel);
    return true;
  } catch {
    return false;
  }
}

function upsertLine(id: string, text: string, state: StepState): void {
  if (!ensurePanel("Coursera Toolkit — tiến trình")) return;
  try {
    let li = lines.get(id);
    if (!li || !li.isConnected) {
      li = document.createElement("li");
      Object.assign(li.style, { margin: "3px 0", wordBreak: "break-word" });
      lines.set(id, li);
      listEl?.appendChild(li);
    }
    li.textContent = `${ICONS[state]} ${text}`;
    li.style.color =
      state === "error" ? "#fca5a5" : state === "active" ? "#fde68a" : "#f9fafb";
    panel?.scrollTo({ top: panel.scrollHeight });
  } catch {
    /* panel errors never break the run */
  }
}

export const progress = {
  /** Reset the panel and set its title. */
  start(title: string): void {
    try {
      window.clearTimeout(hideTimer);
      if (panel) {
        panel.remove();
        panel = null;
        lines.clear();
      }
      ensurePanel(title);
    } catch {
      /* ignore */
    }
  },
  step(id: string, text: string, state: StepState = "active"): void {
    upsertLine(id, text, state);
  },
  finish(text: string): void {
    upsertLine("finish", text, "done");
    if (titleEl) titleEl.textContent = "Coursera Toolkit — hoàn tất";
    try {
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        panel?.remove();
        panel = null;
        lines.clear();
      }, 30000);
    } catch {
      /* ignore */
    }
  },
  fail(text: string): void {
    upsertLine("fail", text, "error");
    if (titleEl) titleEl.textContent = "Coursera Toolkit — có lỗi";
  }
};
