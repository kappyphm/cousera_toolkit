# v3.02 — Bypass Locked Browser

Source: `script.js` (34 lines, plain), `assets/chunk-674d105d.js` (`zD`, `DD`, `Po`), `assets/chunk-67a65bb5.js` (background `D/v/p`, `tabs.onUpdated`, `onMessage`), `manifest.json` wiring.

```
page world (script.js) <-> BypassCoursera_Intercept <-> isolated content (zD/DD/Po) <-> background (cookies/tabs)
```

## 1. Manifest wiring (verbatim)

```json
{
  "content_scripts": [
    {
      "js": ["assets/index.ts-loader-2cc9e0cd.js"],
      "matches": ["https://www.coursera.org/*"]
    }
  ],
  "background": { "service_worker": "service-worker-loader.js", "type": "module" },
  "permissions": ["storage", "cookies", "tabs"],
  "host_permissions": ["<all_urls>"],
  "web_accessible_resources": [
    { "resources": ["script.js"], "matches": ["<all_urls>"] },
    { "resources": ["assets/chunk-674d105d.js"], "matches": ["https://www.coursera.org/*"] }
  ]
}
```

## 2. Page-world hook — `script.js` (verbatim full file)

```js
(function () {
  const userAgent = 'coursera-locking-browser/0.6.3';

  try {
    Object.defineProperty(navigator, 'userAgent', {
      get: () => userAgent,
      configurable: false,
    });
  } catch (_e) {}

  window.coursera = window.coursera || {};

  const shouldIntercept = (url) => typeof url === 'string' && url.startsWith('coursera-lock://');
  const shouldBlock = (url) =>
    typeof url === 'string' &&
    (url.includes('submission-start') || url.includes('submission-complete'));
  const intercept = (url) => {
    window.dispatchEvent(new CustomEvent('BypassCoursera_Intercept', { detail: url }));
  };

  const originalOpen = window.open;
  window.open = function (url, ...args) {
    if (shouldBlock(url)) {
      return null;
    }

    if (shouldIntercept(url)) {
      intercept(url);
      return { closed: false, focus: () => {}, close: () => {} };
    }

    return originalOpen.apply(this, [url, ...args]);
  };
})();
```

Behavior:

- Spoofs `navigator.userAgent` to `coursera-locking-browser/0.6.3` (non-configurable getter).
- `window.open(url)` returns `null` for `submission-start|submission-complete` (kills proctored popups).
- Emits `BypassCoursera_Intercept` with `detail=url` for `coursera-lock://*`, returns fake window `{closed:false,focus,close}` so callers do not crash.

## 3. Injection — `zD`

```js
const zD = () => {
  const t = document.createElement("script");
  t.type = "text/javascript"; // key name obfuscated
  t.src = chrome.runtime.getURL("script.js");
  t.onload = () => t.remove();
  (document.head || document.documentElement).appendChild(t);
};
zD();
DD();
```

Must run in isolated content but injects into MAIN world because `chrome.runtime.getURL("script.js")` is web-accessible.

## 4. Interception — `DD`

Original `McUJH` key is plain (verified):

```js
// @767108 context (verbatim excerpt):
McUJH:"BypassCoursera_Intercept",hoptZ:e(276),DQFFw:e(308),XkaIi:e(351)
```

Reconstructed `DD()`:

```js
const DD = () => {
  // 4a. click capture: walk up from e.target to document
  document.addEventListener("click", (e) => {
    let a = e.target;
    while (a && a !== document) {
      const l = a.href || a.getAttribute?.("href");
      if (l && (l.startsWith("coursera-lock://") || l.startsWith("https://"))) {
        // only coursera-lock is forwarded; https branch is guard/filtered
        e.preventDefault(); e.stopPropagation();
        Po(l);
        return;
      }
      a = a.parentElement;
    }
  }, true);

  // 4b. harden dynamically added links
  new MutationObserver(() => {
    for (const x of document.querySelectorAll("[href]")) {
      if (x.bypassed) continue;
      x.bypassed = true;
      x.addEventListener("click", (l) => {
        l.preventDefault(); l.stopPropagation();
        Po(x.getAttribute("href") || x.href);
      }, true);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // 4c. page-world bridge
  window.addEventListener("BypassCoursera_Intercept", (e) => {
    if (e.detail) Po(e.detail);
  });

  // 4d. poll inline payloads every 500ms
  const t = () => {
    if (window.location.pathname.includes(/* locked path */)) {
      const st = document.createElement("style"); /* hide overlay */;
      document.head.appendChild(st);
      const m = document.body.innerHTML.match(/coursera-lock:\/\/[^"']+/);
      if (m) { Po(m[0]); return; }
    } else if (/* other locked path */) {
      const m = document.body.innerHTML.match(/coursera-lock:\/\/[^"']+/);
      if (m) { Po(m[0]); return; }
    }
    setTimeout(t, 500);
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", t);
  else if (/* guard */) t();
};
```

## 5. URL handling — `Po`

```js
const Po = (urlStr) => {
  const u = new URL(urlStr);
  const token = u.searchParams.get(/* token key, e.g. LhXvf */);
  u.searchParams.delete(/* same key */);
  const clean = u.toString();
  if (token) {
    chrome.runtime.sendMessage({ action: "performTransfer", token, redirectUrl: clean });
    return;
  }
  chrome.runtime.sendMessage({ action: "openTab", url: clean });
};
```

Two outcomes: token-bearing links go through cookie transfer; plain links just open.

## 6. Background — `D`, `v`, `p`, guards, router

Decoded background strings (Node-evaluated `w()/i()`, base 377):

```
383: "https://submission-start/"
458: "submission-start/"
482: "submission-complete/"
468: "https://www.coursera.org"
414: "CSRF3-Token", 410: "csrf3Token", 495: "CAUTH"-class key
479: "https://pear104.github.io/coursera-tool/metadata.json", 488: "/check"
444: "runtime", 379: "tabs", 409: "create", 397: "action"
```

### 6.1 Cookie sync — `v`

```js
const v = async (cookieName, storeKey) => {
  await chrome.cookies.get(
    { url: "https://www.coursera.org", name: cookieName },
    async (t) => {
      if (t) await chrome.storage.local.set({ [storeKey]: t.value });
    }
  );
};
// used as:
await v("CSRF3-Token", "csrf3Token");
await v("CAUTH", "CAUTH");
```

Triggered on `tabs.onUpdated` URL change and on `getMetadata` message.

### 6.2 Token transfer — `D`

```js
const D = async (urlStr) => {
  const x = new URL(urlStr);
  const t = x.searchParams.get(/* token param */);
  if (t) {
    x.searchParams.delete(/* token param */);
    await chrome.cookies.set({
      url: "https://www.coursera.org",
      name: /* cookie name */,
      value: t,
      secure: true,
      sameSite: "no_restriction"
    });
  }
  return x.toString();
};
```

### 6.3 Popup killer — `p` + `tabs.onUpdated`

```js
const p = (urlStr) =>
  urlStr?.startsWith("https://submission-start/") ||
  urlStr?.startsWith("https://submission-complete/") ||
  urlStr?.includes("submission-start/") ||
  urlStr?.includes("submission-complete/");

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    await v(/* CSRF3-Token */, /* csrf3Token */);
    await v(/* CAUTH */, "CAUTH");
  }
  const f = changeInfo.url || tab.url;
  if ((changeInfo.status === "complete" || changeInfo.url) && p(f)) {
    try { await chrome.tabs.remove(tabId); }
    catch (c) { console.log("Tab close error:", c); }
  }
});
```

Also `onInstalled` opens `welcome.html` when `reason === "install"`.

### 6.4 Message router — `onMessage`

Tail (verbatim obfuscated, keys partially plain):

```js
// ...export{M as getSource};
```

Reconstructed actions:

| `action` | Payload | Background does |
|---|---|---|
| `openTab` | `{url}` | `chrome.tabs.create({url})` foreground |
| `openInBackground` | `{url}` | `chrome.tabs.create({url, active:false})` (also used for `metadata.ext` ads) |
| `openOnly` | `{url}` | foreground + `sendResponse({success:true})` |
| `closeCurrentTab` | — | `chrome.tabs.remove(sender.tab.id)` |
| `getMetadata` / `sync` | — | `await v(...); await v(...,"CAUTH"); sendResponse({status:"ok"})` |
| `performTransfer` | `{redirectUrl}` | `o = await D(redirectUrl); chrome.tabs.create({url:o})`, fallback to raw URL on error |

## 7. Clone checklist (v3.02)

- [ ] Copy `script.js` verbatim (UA + hook).
- [ ] `zD()` injector + `DD()` 4 mechanisms (click, observer, bridge, poll).
- [ ] `Po()` token split + two message paths.
- [ ] Background `v/D/p`, `onUpdated` killer, `onMessage` 6-action router, cookie sync.
- [ ] Keep `web_accessible_resources` for `script.js`.
