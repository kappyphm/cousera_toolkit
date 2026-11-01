// Coursera DOM utilities (split from the former shared/coursera.ts).
import { CloneError, createLogger } from "./logger.ts";

const log = createLogger("coursera-dom");

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Reconstruction of the prototype's `se` wait helper — its body was
 * never decoded (no analysis doc contains it), so the mechanics here
 * (poll querySelector every 100ms, reject on timeout, 5000ms default)
 * are the clone's own, NOT a verified port. Call sites pass the
 * bundle's decoded timeout values. A call site that must survive a
 * timeout catches the rejection itself (e.g. Pd §3.1, issue #46).
 * Replace wholesale when se() is extracted from the bundle.
 */
export function waitForSelector<T extends Element = Element>(
  selector: string,
  timeoutMs = 5000
): Promise<T> {
  log.debug("waitForSelector", `waiting ${selector}`, { timeoutMs });
  const started = performance.now();
  return new Promise<T>((resolve, reject) => {
    const timer = window.setInterval(() => {
      const el = document.querySelector<T>(selector);
      if (el) {
        window.clearInterval(timer);
        window.clearTimeout(killer);
        log.debug("waitForSelector", `found ${selector}`, {
          ms: Math.round(performance.now() - started)
        });
        resolve(el);
      }
    }, 100);
    const killer = window.setTimeout(() => {
      window.clearInterval(timer);
      const err = new CloneError(`Element not found within ${timeoutMs}ms`, {
        module: "coursera-dom",
        step: "waitForSelector",
        ms: timeoutMs
      });
      log.error("waitForSelector", selector, { ms: timeoutMs });
      reject(err);
    }, timeoutMs);
  });
}

/**
 * Progress toast — the prototype CALLER renders a toast containing
 * `<span id="progress">` (decoded style: border 1px solid #0356fc,
 * position top-right) before running dD/vD, and the flow updates that
 * span. The clone has no panel, so the content script creates the same
 * element itself (F3 fix — previously the span never existed and every
 * progress write went nowhere).
 */
export function showProgressToast(html: string): HTMLElement {
  document.getElementById("clone-progress-toast")?.remove();
  const el = document.createElement("div");
  el.id = "clone-progress-toast";
  el.setAttribute(
    "style",
    "position:fixed;top:16px;right:16px;z-index:99999;background:#fff;" +
      "border:1px solid #0356fc;border-radius:8px;padding:10px 14px;" +
      "font:14px system-ui;color:#111;box-shadow:0 4px 16px rgba(0,0,0,.18)"
  );
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}
