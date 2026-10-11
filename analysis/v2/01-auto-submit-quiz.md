# v2.01 — Auto Submit Quiz (submit half of `x2 as handleAutoquiz`)

Source: `assets/chunk-674d105d.js` `x2` (~705766). Filling logic is in `v3/01-ai-auto-quiz.md`; this file covers only the submit/automation half.

## 1. Storage flag — `isAutoSubmitQuiz`

Original state definition (verbatim, `pv` hook):

```js
const pv=()=>{const e={kEHAo:function(r,i){return r(i)}},[n,t]=e.kEHAo(q.useState,{isAutoSubmitQuiz:!![],isDebugMode:![],method:ot.Gemini,discussionWaitingTime:20,isShowSettings:![]});return{options:n,setOptions:t}};
```

Decoded: default `{ isAutoSubmitQuiz: true, isDebugMode: false, method: "Gemini", discussionWaitingTime: 20 }`.

Verified plain hit:

```js
// @293221 context
...q.useState,{isAutoSubmitQuiz:!![],isDebugMode:![],method:ot.Gemini,discussionWaitingTime:20,isShowSettings:![]}...
```

Popup behavior:

```js
const { isAutoSubmitQuiz } = await chrome.storage.local.get("isAutoSubmitQuiz");
if (isAutoSubmitQuiz === undefined)
  await chrome.storage.local.set({ isAutoSubmitQuiz: true });
// toggle:
onChange: (_) => chrome.storage.local.set({ isAutoSubmitQuiz: !current });
```

Gate inside `x2`:

```js
const { isAutoSubmitQuiz: x } = await chrome.storage.local.get("isAutoSubmitQuiz");
// ...(x ?? false) decides whether to click submit; else fill-only and return
```

## 2. Pre-submit waiting

`x2` toast wrapper uses `loading: "Processing quiz..."`, `success: "Quiz completed!"`, `error: "Failed to process quiz"`.

Guards (decoded selectors):

```js
if (!location.href.includes("/attempt")) {
  await se(/* quiz container */, 3600000); // wait up to 1h
}
if (location.href.includes("/view-feedback")) return;
await se(".css-1hhf6i, .rc-FormPartsQuestion", 20000);
```

Back-button trap:

```js
// Rqxdz = '[data-testid="tunnel-vision-content"]'
// FrNyO = "button[aria-label='Back']"
const back = document.querySelector("button[aria-label='Back']");
back?.addEventListener("click", () => { /* window.back() handling */ });
await se(/* feedback-icon container: .rc-CodeBlock, .icon-container, [data-testid="action-feedback-icon-container"] */, 6000);
await sleep(5000);
```

## 3. Submit pass 1 — dialog

Decoded selectors:

- `button[data-testid="submit-button"], button[data-test="submit-button"]`
- `.cds-Dialog-dialog`
- `.cds-Modal-container`
- `button[data-testid="dialog-submit-button"]`
- `#agreement-checkbox-base`
- `[data-testid="input-area"] input`

Flow:

```js
const l = document.querySelectorAll(".css-1hhf6i, .rc-FormPartsQuestion");
const u = await cC(code);      // server answers (v3)
const i = await rD(l, u);      // fill (v3); i = unmatched[]
set({ isLoadingQuiz: false });
await se(/* submit-button */, 6000).then((g) => g.click());

if (isAutoSubmitQuiz) {
  const g = document.querySelector(".cds-Dialog-dialog");
  await se(/* agreement/input */, 2000).then((y) => {
    y.click();
    y.dispatchEvent(new Event("input", { bubbles: true }));
  });
  if (!g) await se(".cds-Modal-container", 10000).then((y) => y.click());
  await se('button[data-testid="dialog-submit-button"]', 10000).then((y) => y.click());
  if (!i || i.length === 0) return;
}
```

Cover/start variants also handled:

```js
// s(411), s(357):
"button[data-testid='CoverPageActionButton'], button[data-testid='action-button'], a[data-testid='action-button'], button[data-testid='view-submission-button']"
"button[data-testid='StartAttemptModal__primary-button'], [data-testid='action-button']"
```

## 4. Submit pass 2 — tunnel-vision + feedback

```js
let h = document.querySelector('[data-testid="tunnel-vision-content"]');
while (h) {
  await sleep(1000);
  h = document.querySelector('[data-testid="tunnel-vision-content"]');
}
await sleep(2000);

const m = document.querySelector('button[data-testid="view-feedback-button"]');
m?.click();

await oD(i, code); // upload unmatched/correct (v3/v4)
```

So there are **two** `dialog-submit-button` clicks: one right after `submit-button`, one after the tunnel-vision overlay disappears.

## 5. Clone checklist (v2.01)

- [ ] `isAutoSubmitQuiz` storage default `true` + popup toggle.
- [ ] Wait `/attempt`, skip `/view-feedback`, wait `.rc-FormPartsQuestion`.
- [ ] Fill via v3 module, then pass-1 dialog submit.
- [ ] Tunnel-vision poll, pass-2 submit, `view-feedback` click, `oD()` upload.
- [ ] Fill-only mode when flag is `false`.
