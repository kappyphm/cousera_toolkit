// Content entry — action router + side-panel bridge (v1: video/reading
// + discussing; v2: submit assignment + request grading + AI text
// submit via Gemini; v3: the UI lives in the chrome.sidePanel page —
// this script only runs actions and streams logs/progress to it).
import { sleep } from "../platform/coursera-dom.ts";
import type { ToolkitEvent, ToolkitEventEnvelope } from "../platform/bridge.ts";
import { createLogger, subscribeLogs } from "../platform/logger.ts";
import { handleReview } from "./features/peer-review.ts";
import { handleAutoquiz } from "./features/auto-quiz.ts";
import { handlePeerGradedAssignment } from "./features/submit-assignment.ts";
import { handleTextAssignmentSubmit } from "./features/submit-text-assignment.ts";
import { subscribeProgress } from "./progress.ts";
import { requestGradingByPeer } from "./features/request-peer-grading.ts";
import { handleDiscussionPrompt } from "./features/skip-discussing.ts";
import { resolveWeekMaterial } from "./features/skip-video-reading.ts";
import { createLauncher } from "./launcher.ts";

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

// Course-page launcher (issue #50): per-item buttons in the outline
// that navigate + auto-run the matching flow via this same dispatch.
createLauncher({ dispatch: runAction }).start();
