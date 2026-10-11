// Content entry — message router. v1 wires skip-video-reading;
// skip-discussing is added in the next commit.
import { createLogger } from "../shared/logger.ts";
import { resolveWeekMaterial } from "./skip-video-reading.ts";

const log = createLogger("content");

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const action = (msg as { action?: string })?.action;
  log.info("onMessage", `action=${String(action)}`);
  if (action === "skip-video-reading") {
    resolveWeekMaterial()
      .then(() => sendResponse({ ok: true }))
      .catch((e: unknown) => {
        log.error("onMessage", "skip-video-reading failed", {
          error: (e as Error).message
        });
        sendResponse({ ok: false, error: (e as Error).message });
      });
    return true;
  }
  sendResponse({ ok: false, error: `unknown action ${String(action)}` });
  return false;
});

export function onExecute(): void {
  log.info("onExecute", "content loaded");
}
onExecute();
