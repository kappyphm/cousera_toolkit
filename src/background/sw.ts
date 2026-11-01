// Background service worker: the switchboard between the side panel
// and the content scripts (issue #34). No license gate, no ads.
//  - The toolbar icon opens the side panel natively
//    (openPanelOnActionClick) — there is no popup and no in-page UI.
//  - Panel -> here: a long-lived port named "panel" carries run
//    commands; each is relayed to the content script of the active
//    Coursera tab and the outcome returns as a run-done event.
//  - Content -> here: runtime messages {kind:"toolkit-event"} with
//    log/progress events are forwarded to every connected panel.

import type {
  BgToPanel,
  PanelToBg,
  ToolkitEventEnvelope
} from "../shared/bridge.ts";

const log = (msg: string, extra: unknown = {}) =>
  console.info(`[info] background.sw ${msg}`, extra);

void chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((e: unknown) => log("setPanelBehavior failed", { error: String(e) }));

const panelPorts = new Set<chrome.runtime.Port>();

function postTo(port: chrome.runtime.Port, msg: BgToPanel): void {
  try {
    port.postMessage(msg);
  } catch {
    /* panel closed mid-flight — the port is pruned on disconnect */
  }
}

async function relayRun(
  action: string,
  reply: (m: BgToPanel) => void
): Promise<void> {
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });
  const tab = tabs[0];
  if (!tab?.id || !(tab.url ?? "").startsWith("https://www.coursera.org/")) {
    reply({
      kind: "run-done",
      action,
      ok: false,
      error:
        "Tab đang mở không phải trang Coursera — mở một trang coursera.org rồi thử lại."
    });
    return;
  }
  try {
    const res = (await chrome.tabs.sendMessage(tab.id, { action })) as
      | { ok?: boolean; error?: string }
      | undefined;
    if (res?.ok === true) {
      reply({ kind: "run-done", action, ok: true });
    } else {
      reply({
        kind: "run-done",
        action,
        ok: false,
        error: res?.error ?? "Content script không phản hồi."
      });
    }
  } catch {
    reply({
      kind: "run-done",
      action,
      ok: false,
      error: "Trang Coursera chưa nạp toolkit — tải lại trang (F5) rồi thử lại."
    });
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "panel") return;
  panelPorts.add(port);
  port.onDisconnect.addListener(() => {
    panelPorts.delete(port);
  });
  port.onMessage.addListener((msg: PanelToBg) => {
    if (msg?.type === "run" && typeof msg.action === "string") {
      void relayRun(msg.action, (m) => postTo(port, m));
    }
  });
});

chrome.runtime.onMessage.addListener((msg: ToolkitEventEnvelope) => {
  if (msg?.kind !== "toolkit-event" || !msg.event) return false;
  for (const p of panelPorts) postTo(p, msg.event);
  return false;
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  log("onInstalled", { reason });
  if (reason === "install") {
    void chrome.tabs
      .create({ url: chrome.runtime.getURL("welcome.html") })
      .catch((e: unknown) => {
        console.error("[error] background.onInstalled create welcome failed", e);
        throw e;
      });
  }
});
