// Content entry — message router (v1: video/reading + discussing;
// v2: submit assignment + request grading + AI text submit via Gemini).
import { sleep } from "../shared/coursera.ts";
import { createLogger } from "../shared/logger.ts";
import { handlePeerGradedAssignment } from "./auto-submit-assignment.ts";
import { handleTextAssignmentSubmit } from "./auto-text-submit.ts";
import { requestGradingByPeer } from "./request-grading-by-peer.ts";
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
    // Caller parity (prototype, analysis/v1/01 §1): the caller awaits
    // dD(), sleeps 1000ms, then reloads — the reload lives HERE, not
    // inside resolveWeekMaterial.
    resolveWeekMaterial()
      .then(async () => {
        sendResponse({ ok: true });
        await sleep(1000);
        window.location.reload();
      })
      .catch((e: unknown) => fail("skip-video-reading", e, sendResponse));
    return true;
  }
  if (action === "skip-discussing") {
    handleDiscussionPrompt(m.waitingTimeSec ?? 20, m.content)
      .then(() => sendResponse({ ok: true }))
      .catch((e: unknown) => fail("skip-discussing", e, sendResponse));
    return true;
  }
  if (action === "submit-assignment") {
    handlePeerGradedAssignment()
      .then(() => sendResponse({ ok: true }))
      .catch((e: unknown) => fail("submit-assignment", e, sendResponse));
    return true;
  }
  if (action === "request-grading-by-peer") {
    requestGradingByPeer()
      .then(() => sendResponse({ ok: true }))
      .catch((e: unknown) => fail("request-grading-by-peer", e, sendResponse));
    return true;
  }
  if (action === "submit-text-assignment") {
    handleTextAssignmentSubmit()
      .then(() => sendResponse({ ok: true }))
      .catch((e: unknown) => fail("submit-text-assignment", e, sendResponse));
    return true;
  }
  sendResponse({ ok: false, error: `unknown action ${String(action)}` });
  return false;
});

export function onExecute(): void {
  log.info("onExecute", "content loaded");
}
onExecute();
