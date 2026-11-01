// Course-page launcher (issue #50) — injects per-item action buttons
// into the course outline / navigation and drives the matching flow
// after navigation. The side panel stays the control center (Gemini
// settings, logs); these buttons are in-page shortcuts that reuse the
// exact same dispatch (main.ts runAction) as the panel buttons.
//
// Design notes:
// - Item type is read from the anchor href (/learn/<course>/<type>/
//   <itemId>/...), not from CSS classes — href patterns survive the
//   markup churn that keeps killing class-based selectors.
// - A click stores a pending run in chrome.storage.local and a driver
//   loop (500ms tick) walks it through its stages until it dispatches
//   on the target page or expires (+180s). The driver keeps working
//   across SPA route changes because it re-reads location each tick.
// - "Tắt chấm AI" (request-grading-by-peer) is irreversible, so its
//   button needs two taps: the first arms it (label turns into a
//   confirmation for a few seconds), the second actually starts.
import { sleep } from "../platform/coursera-dom.ts";
import { createLogger } from "../platform/logger.ts";

const log = createLogger("launcher");

export interface PendingRun {
  action: string;
  itemBase: string;
  stage: "final" | "item" | "hub" | "review";
  stageEnteredAt: number;
  expiresAt: number;
}

export interface PendingStorage {
  get(): Promise<PendingRun | null>;
  set(p: PendingRun): Promise<void>;
  clear(): Promise<void>;
}

export interface LauncherDeps {
  dispatch: (action: string) => Promise<void>;
  storage?: PendingStorage;
  navigate?: (href: string) => void;
  tickMs?: number;
  settleMs?: number;
  hopTimeoutMs?: number;
  armMs?: number;
  pendingTtlMs?: number;
}

export interface ItemRef {
  type: string;
  itemBase: string;
}

const ACTIONABLE_TYPES: Record<
  string,
  { action: string; label: string; confirm?: boolean }[]
> = {
  quiz: [{ action: "auto-quiz", label: "❓ Làm quiz" }],
  assignment: [{ action: "submit-text-assignment", label: "🤖 Fill assignment" }],
  peer: [
    { action: "submit-assignment", label: "📤 Nộp bài" },
    { action: "request-grading-by-peer", label: "🎓 Tắt chấm AI", confirm: true },
    { action: "review-peers", label: "📝 Chấm peer" }
  ]
};

/**
 * Classify a Coursera item link. Returns the item type and its base
 * path (/learn/<course>/<type>/<itemId>), or null for non-items and
 * for sub-page links (give-feedback, review, ...) — buttons belong on
 * the item's own outline row, not on its inner pages' links.
 */
export function classifyItemHref(href: string): ItemRef | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.hostname !== "www.coursera.org") return null;
  const seg = url.pathname.split("/").filter((s) => s.length > 0);
  if (seg.length < 4 || seg[0] !== "learn") return null;
  const [, course, type, itemId] = seg;
  if (!course || !itemId || !(type in ACTIONABLE_TYPES)) return null;
  const itemBase = `/learn/${course}/${type}/${itemId}`;
  const rest = seg.slice(4);
  if (rest.length > 1) return null;
  if (rest.length === 1 && (rest[0] === "give-feedback" || rest[0].startsWith("review"))) {
    return null;
  }
  return { type, itemBase };
}

function isReviewPage(): boolean {
  return /\/review-next(\/|$)/.test(location.pathname) || /\/review\//.test(location.pathname);
}

const memoryStorage = (): PendingStorage => {
  let value: PendingRun | null = null;
  return {
    async get() {
      return value;
    },
    async set(p) {
      value = p;
    },
    async clear() {
      value = null;
    }
  };
};

const defaultStorage = (): PendingStorage => {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return memoryStorage();
  const KEY = "pendingAutoRun";
  return {
    async get() {
      const out = (await chrome.storage.local.get(KEY)) as Record<string, unknown>;
      return (out[KEY] as PendingRun | undefined) ?? null;
    },
    async set(p) {
      await chrome.storage.local.set({ [KEY]: p });
    },
    async clear() {
      await chrome.storage.local.remove(KEY);
    }
  };
};

const BUTTON_STYLE =
  "font:12px system-ui;padding:2px 8px;border:1px solid #0056d2;color:#0056d2;" +
  "background:#fff;border-radius:999px;cursor:pointer;white-space:nowrap";
const ARMED_STYLE =
  "font:12px system-ui;padding:2px 8px;border:1px solid #b3261e;color:#fff;" +
  "background:#b3261e;border-radius:999px;cursor:pointer;white-space:nowrap";

export function createLauncher(deps: LauncherDeps) {
  const storage = deps.storage ?? defaultStorage();
  const navigate = deps.navigate ?? ((href: string) => location.assign(href));
  const tickMs = deps.tickMs ?? 500;
  const settleMs = deps.settleMs ?? 800;
  const hopTimeoutMs = deps.hopTimeoutMs ?? 15000;
  const armMs = deps.armMs ?? 3500;
  const pendingTtlMs = deps.pendingTtlMs ?? 180000;

  let driving = false;
  let started = false;
  let stopped = false;
  let observer: MutationObserver | null = null;

  /** Inject buttons next to every not-yet-processed item link. */
  function scan(): void {
    const anchors = document.querySelectorAll<HTMLAnchorElement>("a[href]");
    anchors.forEach((a) => {
      if (a.dataset.cloneLauncher) return;
      if (a.closest(".clone-launcher")) return;
      const ref = classifyItemHref(a.href);
      if (!ref) return;
      a.dataset.cloneLauncher = ref.type;
      const box = document.createElement("span");
      box.className = "clone-launcher";
      box.setAttribute(
        "style",
        "display:inline-flex;gap:4px;margin-left:8px;vertical-align:middle"
      );
      for (const b of ACTIONABLE_TYPES[ref.type]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = b.label;
        btn.setAttribute("style", BUTTON_STYLE);
        btn.dataset.cloneAction = b.action;
        btn.dataset.cloneItemBase = ref.itemBase;
        btn.dataset.cloneHref = a.href;
        if (b.confirm) btn.dataset.cloneConfirm = "1";
        box.appendChild(btn);
      }
      a.insertAdjacentElement("afterend", box);
    });
  }

  async function startRun(action: string, itemBase: string, href: string): Promise<void> {
    const now = Date.now();
    const pending: PendingRun = {
      action,
      itemBase,
      stage: action === "review-peers" ? "item" : "final",
      stageEnteredAt: now,
      expiresAt: now + pendingTtlMs
    };
    await storage.set(pending);
    log.info("click", `pending run set: ${action} -> ${itemBase}`, { action, itemBase });
    if (!location.pathname.startsWith(itemBase)) {
      navigate(href);
    }
    void drive();
  }

  function onClick(e: Event): void {
    const target = e.target as Element | null;
    const btn = target?.closest?.("button[data-clone-action]") as HTMLElement | null;
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const action = btn.dataset.cloneAction!;
    const itemBase = btn.dataset.cloneItemBase!;
    const href = btn.dataset.cloneHref!;
    // Two-tap confirmation for the irreversible disable-AI action.
    if (btn.dataset.cloneConfirm === "1" && btn.dataset.armed !== "1") {
      btn.dataset.armed = "1";
      btn.dataset.label = btn.textContent ?? "";
      btn.textContent = "🎓 Chắc chắn tắt AI?";
      btn.setAttribute("style", ARMED_STYLE);
      window.setTimeout(() => {
        if (btn.dataset.armed === "1") {
          delete btn.dataset.armed;
          btn.textContent = btn.dataset.label ?? btn.textContent;
          btn.setAttribute("style", BUTTON_STYLE);
        }
      }, armMs);
      log.info("click", "disable-AI armed — second tap confirms", { itemBase });
      return;
    }
    void startRun(action, itemBase, href);
  }

  async function setStage(p: PendingRun, stage: PendingRun["stage"]): Promise<PendingRun> {
    const next = { ...p, stage, stageEnteredAt: Date.now() };
    await storage.set(next);
    log.info("drive", `stage -> ${stage} (${p.action})`, { action: p.action, stage });
    return next;
  }

  /** One driver step. Returns true when the run is finished. */
  async function stepOnce(p: PendingRun): Promise<boolean> {
    const path = location.pathname;

    if (p.stage === "final") {
      if (!path.startsWith(p.itemBase)) return false;
      await sleep(settleMs);
      await storage.clear();
      log.info("drive", `dispatch ${p.action} on ${p.itemBase}`, { action: p.action });
      try {
        await deps.dispatch(p.action);
      } catch (err) {
        log.error("drive", `${p.action} failed`, { error: (err as Error).message });
      }
      return true;
    }

    if (p.stage === "item") {
      if (isReviewPage()) {
        await setStage(p, "review");
        return false;
      }
      if (path.includes("/give-feedback")) {
        await setStage(p, "hub");
        return false;
      }
      if (!path.startsWith(p.itemBase)) return false;
      const link = document.querySelector<HTMLAnchorElement>('a[href*="/give-feedback"]');
      if (link) {
        log.info("drive", "clicking the page's give-feedback link");
        link.click();
        await setStage(p, "hub");
        return false;
      }
      if (Date.now() - p.stageEnteredAt > hopTimeoutMs) {
        // Fallback: the hub path pattern under the item base. This hop
        // is the one part not yet verified live (issue #50) — if the
        // hub stage then times out, the run aborts with a clear log.
        log.warn("drive", "no give-feedback link found — trying the constructed hub URL");
        navigate(`${location.origin}${p.itemBase}/give-feedback`);
        await setStage(p, "hub");
      }
      return false;
    }

    if (p.stage === "hub") {
      if (isReviewPage()) {
        await setStage(p, "review");
        return false;
      }
      if (!path.includes("/give-feedback")) return false;
      const text = document.body?.textContent ?? "";
      if (/submit your project before reviewing/i.test(text)) {
        log.warn("drive", "hub blocked — submit the project before reviewing; run stopped");
        await storage.clear();
        return true;
      }
      const startBtn = [...document.querySelectorAll<HTMLElement>("button")].find((b) =>
        /start reviewing/i.test(b.textContent ?? "")
      );
      if (startBtn) {
        log.info("drive", "clicking Start Reviewing on the hub");
        startBtn.click();
        await setStage(p, "review");
        return false;
      }
      if (Date.now() - p.stageEnteredAt > hopTimeoutMs) {
        log.error("drive", "hub reached but no Start Reviewing button — run stopped");
        await storage.clear();
        return true;
      }
      return false;
    }

    // stage === "review"
    if (!isReviewPage()) return false;
    await sleep(settleMs);
    await storage.clear();
    log.info("drive", "dispatch review-peers on the review page");
    try {
      await deps.dispatch("review-peers");
    } catch (err) {
      log.error("drive", "review-peers failed", { error: (err as Error).message });
    }
    return true;
  }

  async function drive(): Promise<void> {
    if (driving) return;
    driving = true;
    try {
      for (;;) {
        if (stopped) return;
        const p = await storage.get();
        if (!p) return;
        if (Date.now() > p.expiresAt) {
          log.warn("drive", `pending run for ${p.action} expired — dropped`, {
            action: p.action
          });
          await storage.clear();
          return;
        }
        if (await stepOnce(p)) return;
        await sleep(tickMs);
      }
    } catch (err) {
      log.error("drive", "driver error", { error: (err as Error).message });
    } finally {
      driving = false;
    }
  }

  function start(): void {
    if (started) return;
    started = true;
    stopped = false;
    if (!location.pathname.includes("/learn/")) return;
    document.addEventListener("click", onClick, true);
    scan();
    let debounce: number | undefined;
    observer = new window.MutationObserver(() => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(scan, 400);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    void drive();
    log.info("init", "course launcher active");
  }

  /** Detach everything (page teardown in production; tests use it to
   * keep instances from leaking across synthetic DOMs). */
  function stop(): void {
    stopped = true;
    observer?.disconnect();
    observer = null;
    document.removeEventListener("click", onClick, true);
  }

  return { start, scan, drive, stop };
}
