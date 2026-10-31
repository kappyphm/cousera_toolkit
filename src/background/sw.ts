// v1 background: no license gate, no ads. Only minimal plumbing.
// Full message router / cookie sync arrives with v3 (bypass module).
const log = (msg: string, extra: unknown = {}) =>
  console.info(`[info] background.sw ${msg}`, extra);

// Toolbar icon toggles the in-page sidebar (the popup is retired).
// Tabs without the content script (anything but coursera.org) simply
// have nothing to toggle — the rejection is expected and swallowed.
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  void chrome.tabs.sendMessage(tab.id, { action: "toggle-sidebar" }).catch(() => {
    log("toggle-sidebar skipped (no content script on this tab)", { tabId: tab.id });
  });
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
