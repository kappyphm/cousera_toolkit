# Coursera Tool Clone — Analysis Index

Source under analysis: `D:\10_FPT_University\build\build` — **Coursera Tool v1.0.8.5** by Pear104.

> Scope: clone only the client-side processing logic. The vendor's profile/license service (`/check` gating) is explicitly out of scope; it is documented only where it gates a flow so the clone can replace it with `true` / local mock.

## Source map (verified)

| File | Size | Role |
|---|---|---|
| `manifest.json` | 66 lines | MV3: `content_scripts` on `https://www.coursera.org/*`, background `service-worker-loader.js`, `permissions: storage,cookies,tabs`, `host_permissions: <all_urls>`, `web_accessible_resources: script.js, assets/chunk-674d105d.js` |
| `assets/index.ts-loader-2cc9e0cd.js` | 338 B | Content-script loader: dynamic `import(chrome.runtime.getURL("assets/chunk-674d105d.js")).onExecute()` |
| `assets/chunk-674d105d.js` | 770,759 B | Main content bundle: all Coursera DOM logic + bundled `@google/genai` SDK. Obfuscated (string tables + rotation + base64). Ends with export map (see below) |
| `assets/chunk-67a65bb5.js` | 8,347 B | Background service worker: cookie sync, tab guard, message router, `M as getSource` |
| `script.js` | 34 lines | Page-world injected script: UA spoof + `window.open` hook |
| `popup.html` / `welcome.html` | — | Popup/welcome UI |

Original export map, `assets/chunk-674d105d.js` tail (verbatim):

```js
export{Et as addBadgeToLabel,SD as appendNotSupported,TD as collectUnmatchedQuestion,px as extendStringPrototype,Ut as generateRandomString,fg as getMetadata,Cr as getSource,x2 as handleAutoquiz,vD as handleDiscussionPrompt,mD as handlePeerGradedAssignment,_D as handleReview,d2 as requestGradingByPeer,dD as resolveWeekMaterial,se as waitForSelector};
```

Original loader, `assets/index.ts-loader-2cc9e0cd.js` (verbatim):

```js
(function () {
  'use strict';

  const injectTime = performance.now();
  (async () => {
    const { onExecute } = await import(
      /* @vite-ignore */
      chrome.runtime.getURL("assets/chunk-674d105d.js")
    );
    onExecute?.({ perf: { injectTime, loadTime: performance.now() - injectTime } });
  })().catch(console.error);

})();
```

Background entry, `service-worker-loader.js` (verbatim):

```js
import './assets/chunk-67a65bb5.js';
```

Background tail export (verbatim, obfuscated identifiers):

```js
});export{M as getSource};
```

## Roadmap -> docs

- **v1:** skip video/reading, skip discussing
  - `v1/01-skip-video-reading.md` — `dD as resolveWeekMaterial` (decoder `an`, base 290)
  - `v1/02-skip-discussing.md` — `vD as handleDiscussionPrompt` (decoder `ke`, base 120)
- **v2:** auto submit, auto grade, disable AI grading, auto peer review, shareable link
  - `v2/01-auto-submit-quiz.md` — `x2 as handleAutoquiz` @ 705766 (decoder `sn`, base 345)
  - `v2/02-auto-grade-disable-ai-grading.md` — `d2 as requestGradingByPeer` @ 752402 (decoder `ln`, base 101)
  - `v2/03-auto-peer-review.md` — `mD` @ 738051, `_D` @ 761766, `Pd` @ 757644 (decoders `Mn`/`Sn`/`Ke`)
  - `v2/04-shareable-link.md` — `yy` @ ~167960 (decoder `Re`, base 492) + background `i` (base 377)
- **v3:** AI auto quiz, bypass locked browser
  - `v3/01-ai-auto-quiz.md`
  - `v3/02-bypass-locked-browser.md`
- **v4:** nodejs server for question/answer collection
  - `v4/01-server-spec.md`

## Reading convention used in all docs

1. **Plain string** = appears verbatim in the bundle (verified by search, e.g. `onDemandCompletedItems.v1`, `AiCoach_CreateUserMessageAndReturnResponse`, `isAutoSubmitQuiz`, `geminiAPI`, `generativelanguage.googleapis.com`).
2. **Decoded string** = recovered by evaluating the obfuscator table + rotation in Node (e.g. `cosemira.com/*`, AES key/IV, most Coursera REST paths, CSS selectors). Marked as decoded with decoder base/rotation where known.
3. **Original snippet** = verbatim copy from the build, including obfuscated wrappers (`n[e(...)]`, `L(...)`, `_0x...` guards). Dead opaque predicates (`"a"==="a"`) are noted but preserved.
4. Endpoints are Coursera-first; all `fetch` in content runs in the `coursera.org` origin so cookies are sent automatically. Common header builder is `{"Content-Type":"application/json", ...(CSRF3-Token?...)}`.

## Common helpers (all versions)

```js
// waitForSelector — se
se = (selector, timeout = 5000) => new Promise((resolve, reject) => {
  // polls document.querySelector(selector) every ~100ms, rejects after timeout
});
```

```js
// getMetadata — fg: reads embedded course JSON from page header
fg = () => JSON.parse(
  document.querySelector(
    '[data-testid="page-header-wrapper"] a[data-track-app="open_course_home"]'
  )?.getAttribute('data-click-value') ?? ""
);
// -> { course_id, item_id, open_course_slug, ... }
```

```js
// sleep
const ze = (ms) => new Promise((r) => setTimeout(r, ms));
```

```js
// CSRF header builder (recurring pattern, verbatim context around onDemandCompletedItems.v1)
x = (y = document["cookie"].match(/(?:^|;\s*)CSRF3-Token\s*=\s*([^;]+)/)) == null ? void 0 : y[1],
l = (v = {}) => ({ "Content-Type": e(385), ...x ? { "X-CSRF3-Token": x } : {}, ...v }),
```
