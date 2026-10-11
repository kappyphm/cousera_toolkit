// v1 background: no license gate, no ads. Only minimal plumbing.
// Full message router / cookie sync arrives with v3 (bypass module).
const log = (msg: string, extra: unknown = {}) =>
  console.info(`[info] background.sw ${msg}`, extra);

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
