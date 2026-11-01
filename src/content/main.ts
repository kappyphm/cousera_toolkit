// Content entry — action router + side-panel bridge (v1: video/reading
// + discussing; v2: submit assignment + request grading + AI text
// submit via Gemini; v3: the UI lives in the chrome.sidePanel page —
// this script only runs actions and streams logs/progress to it).
import { sleep } from "../shared/coursera.ts";
import type { ToolkitEvent, ToolkitEventEnvelope } from "../shared/bridge.ts";
import { createLogger, subscribeLogs } from "../shared/logger.ts";
import { handleReview } from "./auto-peer-review.ts";
import { handleAutoquiz } from "./auto-quiz.ts";
import { handlePeerGradedAssignment } from "./auto-submit-assignment.ts";
import { handleTextAssignmentSubmit } from "./auto-text-submit.ts";
import { subscribeProgress } from "./progress-ui.ts";
import { requestGradingByPeer } from "./request-grading-by-peer.ts";
import { handleDiscussionPrompt } from "./skip-discussing.ts";
import { resolveWeekMaterial } from "./skip-video-reading.ts";

const log = createLogger("content");

export interface ActionMessage {
  waitingTimeSec?: number;
  content?: string;
}

/**
 * Run one toolkit action. Entry point of the runtime message router —
 * commands arrive relayed from the side panel via the background
 * switchboard (tabs.sendMessage).
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

// Side-panel bridge: forward the log feed and the progress snapshots
// to the background switchboard, which relays them to the panel when
// it is open. Fire-and-forget — a closed panel or a restarting worker
// must never disturb the features on the page.
function forward(event: ToolkitEvent): void {
  const envelope: ToolkitEventEnvelope = { kind: "toolkit-event", event };
  void chrome.runtime.sendMessage(envelope).catch(() => {});
}
subscribeLogs((e) =>
  forward({
    kind: "log",
    level: e.level,
    module: e.module,
    step: e.step,
    message: e.message,
    time: e.time.toISOString()
  })
);
subscribeProgress((snapshot) => forward({ kind: "progress", snapshot }));

onExecute();
