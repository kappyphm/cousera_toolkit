// Content entry — action router + in-page sidebar (v1: video/reading +
// discussing; v2: submit assignment + request grading + AI text submit
// via Gemini; v2.1: the toolbar popup is retired for the sidebar).
import { sleep } from "../shared/coursera.ts";
import { createLogger } from "../shared/logger.ts";
import { handleReview } from "./auto-peer-review.ts";
import { handleAutoquiz } from "./auto-quiz.ts";
import { handlePeerGradedAssignment } from "./auto-submit-assignment.ts";
import { handleTextAssignmentSubmit } from "./auto-text-submit.ts";
import { requestGradingByPeer } from "./request-grading-by-peer.ts";
import { initSidebar, toggleSidebar } from "./sidebar.ts";
import { handleDiscussionPrompt } from "./skip-discussing.ts";
import { resolveWeekMaterial } from "./skip-video-reading.ts";

const log = createLogger("content");

export interface ActionMessage {
  waitingTimeSec?: number;
  content?: string;
}

/**
 * Run one toolkit action. Shared by the runtime message router (the
 * toolbar icon's toggle + any external caller) and the sidebar, which
 * calls it directly in-page.
 */
export async function runAction(action: string, m: ActionMessage = {}): Promise<void> {
  switch (action) {
    case "skip-video-reading":
      // Caller parity (prototype, analysis/v1/01 §1): the caller awaits
      // dD(), sleeps 1000ms, then reloads — the reload lives HERE, not
      // inside resolveWeekMaterial.
      await resolveWeekMaterial();
      await sleep(1000);
      window.location.reload();
      return;
    case "skip-discussing":
      await handleDiscussionPrompt(m.waitingTimeSec ?? 20, m.content);
      return;
    case "submit-assignment":
      await handlePeerGradedAssignment();
      return;
    case "request-grading-by-peer":
      await requestGradingByPeer();
      return;
    case "auto-quiz":
      await handleAutoquiz();
      return;
    case "review-peers":
      await handleReview();
      return;
    case "submit-text-assignment":
      await handleTextAssignmentSubmit();
      return;
    default:
      throw new Error(`unknown action ${action}`);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const m = msg as { action?: string } & ActionMessage;
  const action = m?.action;
  log.info("onMessage", `action=${String(action)}`);
  if (action === "toggle-sidebar") {
    toggleSidebar();
    sendResponse({ ok: true });
    return false;
  }
  if (!action) {
    sendResponse({ ok: false, error: "missing action" });
    return false;
  }
  runAction(action, m)
    .then(() => sendResponse({ ok: true }))
    .catch((e: unknown) => {
      log.error("onMessage", `${action} failed`, { error: (e as Error).message });
      sendResponse({ ok: false, error: (e as Error).message });
    });
  return true;
});

export function onExecute(): void {
  log.info("onExecute", "content loaded");
}

// Sidebar first so its log feed also captures the load line below.
initSidebar((action) => runAction(action));
onExecute();
