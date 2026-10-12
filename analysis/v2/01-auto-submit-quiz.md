# v2.01 — Auto Submit Quiz (`x2 as handleAutoquiz`)

Source: `prototype/assets/chunk-674d105d.js` `x2` @ 705766.
Decoder: `sn` (table `na`, base 345, rotation (na, 649582)).

## 1. Export map (verbatim)

```js
export{x2 as handleAutoquiz,...}
```

## 2. Function signature + toast config

```js
const x2=async(e,n)=>{const t=sn,r={ANafX:function(s,a){return s===a},psIrq:t(392),WsQhS:t(395),nAAPF:"wozfY",QiQcJ:t(324),NRBJB:t(323),kOnBY:t(323),lNcxN:"/attempt",...}
```

Decoded toast strings (from `sn` table):
- `sn(349)` = `"Processing quiz..."` (loading)
- `sn(365)` = `"Quiz completed!"` (success)
- `sn(392)` = `"Failed to process quiz"` (error)

## 3. Storage flag — `isAutoSubmitQuiz`

```js
let i=[];
await Un[t(322)](async()=>{
  var p;
  const s=t,a={...};
  {isAutoSubmitQuiz:x}=await chrome.storage.local[s(325)](r.kOnBY);
```

- `chrome.storage.local.get("isAutoSubmitQuiz")` → `x`
- Default in popup state (verbatim, `pv` hook): `{isAutoSubmitQuiz:!![],isDebugMode:![],method:ot.Gemini,discussionWaitingTime:20,isShowSettings:![]}` → `isAutoSubmitQuiz: true`
- Popup toggle: `chrome.storage.local.set({isAutoSubmitQuiz:!current})`

## 4. Guard: `/attempt` required

```js
if(!location[s(400)][s(386)](r[s(330)]))
```

Decoded: `location.href.includes("/attempt")`. If false → wait for quiz to appear.

```js
await r[s(333)](se,r[s(321)],36e5)[s(384)](m=>m[s(393)]()).catch(m=>{});
```

`se(selector, 3600000)` = wait up to **1 hour** for quiz container. Then poll until found.

## 5. Quiz container wait loop

```js
let g=r[s(326)],h=document[s(391)](g);
for(;!h;)await new Promise(m=>setTimeout(m,1e3)),
  await r[s(398)](se,r[s(389)],1e3)[s(384)](m=>m[s(393)]())[s(319)](m=>{}),
  h=document[s(391)](g),
  r[s(367)](n,m=>({...m,isLoadingQuiz:!![]}));
```

Decoded:
- `g = r[326]` = `.css-1hhf6i, .rc-FormPartsQuestion` (quiz question container)
- `h = document.querySelector(g)`
- Loop: poll every 1s until found, set `isLoadingQuiz: true`

## 6. View-feedback guard

```js
if(location.href.includes("/view-feedback")) return;
```

Skip processing on feedback pages.

## 7. Submit pass 1 — dialog

Decoded selectors:
- `sn(411)` = `button[data-testid='CoverPageActionButton'], button[data-testid='action-button'], a[data-testid='action-button'], button[data-testid='view-submission-button']`
- `sn(357)` = `button[data-testid='StartAttemptModal__primary-button'], [data-testid='action-button']`
- `sn(356)` = `.cds-Dialog-dialog`
- `sn(409)` = `#agreement-checkbox-base`
- `sn(403)` = `[data-testid="input-area"] input`
- `sn(413)` = `button[data-testid="dialog-submit-button"]`

Flow (reconstructed from decoded selectors + toast config):

```js
// 1. Fill questions (via v3 AI module — cC/rD)
const questions = document.querySelectorAll(".css-1hhf6i, .rc-FormPartsQuestion");
const answers = await cC(courseCode);      // AI answers (v3)
const unmatched = await rD(questions, answers); // fill (v3)

// 2. Click submit
await se('button[data-testid="submit-button"], button[data-test="submit-button"]', 6000)
  .then(btn => btn.click());

// 3. If auto-submit enabled, handle dialog
if (isAutoSubmitQuiz) {
  // agreement checkbox
  await se('#agreement-checkbox-base, [data-testid="input-area"] input', 2000).then(el => {
    el.click();
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // confirm dialog
  await se('button[data-testid="dialog-submit-button"]', 10000).then(el => el.click());
}
```

## 8. Submit pass 2 — tunnel-vision + feedback

```js
const Rqxdz='[data-testid="tunnel-vision-content"]';
// wait for overlay to disappear
let overlay = document.querySelector(Rqxdz);
while (overlay) {
  await sleep(1000);
  overlay = document.querySelector(Rqxdz);
}
await sleep(2000);
// click view feedback
const feedbackBtn = document.querySelector('button[data-testid="view-feedback-button"]');
feedbackBtn?.click();
```

## 9. Clone checklist (v2.01)

- [ ] `isAutoSubmitQuiz` storage default `true` + popup toggle.
- [ ] Wait `/attempt`, skip `/view-feedback`, wait `.rc-FormPartsQuestion` (up to 1h).
- [ ] Fill via v3 module, then pass-1 dialog submit.
- [ ] Tunnel-vision poll, pass-2 submit, `view-feedback` click, `oD()` upload.
- [ ] Fill-only mode when flag is `false`.
- [ ] Toast strings: `sn(349)` loading, `sn(365)` success, `sn(392)` error.
