// Content entry — message router (v1: video/reading + discussing).
import { createLogger } from "../shared/logger.ts";
import { handleDiscussionPrompt } from "./skip-discussing.ts";
import { resolveWeekMaterial } from "./skip-video-reading.ts";

const log = createLogger("content");

function fail(action: string, e: unknown, sendResponse: (r: unknown) => void): void {
  log.error("onMessage", `${action} failed`, { error: (e as Error).message });
  sendResponse({ ok: false, error: (e as Error).message });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const m = msg as { action?: string; waitingTimeSec?: number; content?: string };
  const action = m?.action;
  log.info("onMessage", `action=${String(action)}`);
  if (action === "skip-video-reading") {
    resolveWeekMaterial()
      .then(() => sendResponse({ ok: true }))
      .catch((e: unknown) => fail("skip-video-reading", e, sendResponse));
    return true;
  }
  if (action === "skip-discussing") {
    handleDiscussionPrompt(m.waitingTimeSec ?? 20, m.content)
      .then(() => sendResponse({ ok: true }))
      .catch((e: unknown) => fail("skip-discussing", e, sendResponse));
    return true;
  }
  sendResponse({ ok: false, error: `unknown action ${String(action)}` });
  return false;
});

export function onExecute(): void {
  log.info("onExecute", "content loaded");
}
onExecute();
