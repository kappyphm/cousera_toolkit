# v2.01 — Auto Submit Assignment (`mD as handlePeerGradedAssignment`)

Source: `prototype/assets/chunk-674d105d.js` `mD` @ 738051–741340 (body len 3289).
Decoder: `Mn` (table `aa`, base 276, rotation (aa, 667555)). All `Mn(276–364)` strings verified against dump.
Supporting functions: `Ut` @ 355936 (random words from `Vc` dictionary, 3702 entries), `hx` @ 379425 (Slate.js editor fill), `hD` @ 734205 (AI-grading detector), `ze` = sleep.

## 1. Export map (verbatim)

```js
export{...,mD as handlePeerGradedAssignment,...}
```

## 2. Trigger (in-page panel, prototype)

```js
// @346935
isLoadingSubmitPeerGrading:!![],
await mD(),
isLoadingSubmitPeerGrading:![]
```

Button `isLoadingSubmitPeerGrading` in the React control panel. Clone wires this to popup action `submit-assignment`.

## 3. Config object (decoded, verbatim values)

```js
n = {
  mxdfF: (t,r)=>t(r),          NolYr: "insertText",
  yISyI: "input",              Npcsj: "change",
  bAssU: "(((.+)+)+)+$",       axCSP: (t,r)=>t===r,
  MXjos: "bONwk",              dThSA: "mLtUb",
  kiAWd: "QxBSg",              qwxMF: "Error handling peer-graded assignment:",
  hRVEd: 'div[role="tablist"] button:nth-child(2)',
  zdkAx: "Help me please! ",
  zfULU: (t)=>t(),             XcFic: (t,r,i)=>t(r,i),
  WZpqL: '#title, input[aria-label="Title"]',
  VJNUG: '#main-container input[type="text"]:not(#title)',
  rxeAu: (t)=>t(r),            nhDiY: (t,r)=>t!==r,
  yJOaE: "KvDEX",              ZJMSg: "textarea",
  WEgRf: (t,r)=>t!==r,         TLmvl: "MNtUh",
  YItCB: '.rc-SubmissionPartEditor, .rc-RichTextMLEditor, .rc-CMLEditor',
  gmVqf: (t,r)=>t<r,           mOOrB: '[contenteditable="true"]',
  zokRZ: (t,r)=>t(r),          SWcfP: ".rc-UppyFileUploader button",
  PQuoj: (t,r)=>t+r,           cFFQH: "session_",
  ydzGe: "text/markdown",      rRkTa: 'input[type="file"]',
  NPmPB: (t,r)=>t(r),          tZdil: 'button[aria-label="Submit"], button[data-e2e="submit-assignment"]',
  tBPwJ: (t,r)=>t(r),          qHLrH: (t,r)=>t(r)
};
```

Index→string source: `Mn(276–364)` dump (`analysis` decoder `Mn`, table `aa`).

## 4. Integrity self-checks (anti-tamper — evaluated)

| Check | Decode | Result | Live branch |
|---|---|---|---|
| `axCSP(n.MXjos, n.MXjos)` | `"bONwk"==="bONwk"` | **true** | title-fill path |
| `dThSA===kiAWd` | `"mLtUb"==="QxBSg"` | **false** | `else` = real fill |
| `nhDiY(n.yJOaE,"KvDEX")` | `"KvDEX"!=="KvDEX"` | **false** | `else` = real fill |
| `WEgRf(n.TLmvl, n.TLmvl)` | `"MNtUh"!=="MNtUh"` | **false** | `else` = real fill |

All junk `_0x...` branches are dead. Clone keeps only live branches.

## 5. Supporting helpers (verbatim logic)

### 5.1 `Ut(e=10, n=" ")` — random words

```js
function Ut(e=10,n=" "){const i=[];for(let s=0;s<e;s++){
  const a=Math.floor(Math.random()*Vc.length);i.push(Vc[a])}return i.join(n)}
```

`Vc` = dictionary array, **3702 words** (decoded from table `Ds` base 156, rotation 984277; alias `o=Vc` entries). Clone ships full dictionary as `src/shared/random-words.json`.

### 5.2 `hx(el, text)` — Slate.js / contenteditable fill @379425

```js
async function hx(el, text) {
  try {
    let target = el;
    if (el.getAttribute("contenteditable") !== "true")
      target = el.querySelector('[contenteditable="true"]')
        || el.querySelector('[data-slate-node="value"]')
        || el.querySelector(".rc-CMLEditor");
    target.focus();
    await sleep(200);
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(target);
      sel.removeAllRanges();
      sel.addRange(range);
      await sleep(100);
      target.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", code: "Backspace", bubbles: true }));
      document.execCommand("delete", false, null);
    }
    await sleep(200);
    const ev = new InputEvent("insertText", { bubbles: true, cancelable: true, inputType: "insertText", data: text });
    target.dispatchEvent(ev) && document.execCommand("insertHTML", false, text.replace(/\n/g, "<br>"));
    await sleep(150);
    await sleep(500);
    return true;
  } catch (e) {
    console.error("Lỗi fill editor Slate.js:", e);   // verbatim Vietnamese log
    return false;
  }
}
```

Integrity check inside `hx`: `flgKf !== flgKf` → false → junk skipped.

### 5.3 `hD()` — AI-grading detector @734205

```js
const hD = async () => {
  const t = await waitForSelector(".disclosure-header", 1000).catch(() => null);
  return t?.textContent?.includes("AI Grading") ?? false;
};
```

Decoded: `Dn(515)`→key `yFAGV`=`.disclosure-header` (table `sa` base 500), `Dn(508)`=`"AI Grading"`.
**Not an AI text generator** (corrects earlier doc 03 claim). Returns whether the page discloses AI Grading — gates the final `d2()` chain.

### 5.4 `i(el, text)` — plain input fill (inline in `mD`)

```js
const i = async (el, text) => {
  if (el) {
    el.click();
    await sleep(200);
    el.focus();
    await sleep(200);
    el.select?.();
    document.execCommand("insertText", false, text);
    await sleep(200);
    el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
};
```

## 6. Main flow — `mD()` reconstructed (verified sequence)

```js
async function mD() {
  try {
    // 1. Switch to the write tab of the submission part editor
    await waitForSelector('div[role="tablist"] button:nth-child(2)')  // n.hRVEd
      .then((btn) => btn.click())
      .catch(() => {});
    await sleep(1000);

    // 2. Title
    const title = "Help me please! ";                // n.zdkAx
    const hasAiGrading = await hD();                 // gate for d2() later

    // 3. Fill title if empty (self-check true → live path)
    await waitForSelector('#title, input[aria-label="Title"]', 1000)
      .then(async (el) => {
        if (!el.value) {
          await sleep(500);
          await i(el, title);
          await sleep(500);
        }
      })
      .catch(() => {});

    // 4. Plain text inputs — random 3 words
    for (const el of document.querySelectorAll('#main-container input[type="text"]:not(#title)')) {
      const words = Ut(3);
      if (!el.value) await i(el, words);
    }

    // 5. Textareas — random 3 words
    for (const el of document.querySelectorAll("textarea")) {
      if (!el.value) await i(el, Ut(3));
    }

    // 6. Rich text editors — Slate fill via hx()
    const editors = document.querySelectorAll(
      '.rc-SubmissionPartEditor, .rc-RichTextMLEditor, .rc-CMLEditor');
    const seen = new Set();
    for (let idx = 0; idx < editors.length; idx++) {
      const ed = editors[idx];
      if (!ed?.isConnected) continue;
      const target = ed.querySelector('[contenteditable="true"]') || ed;
      if (target?.isConnected && !seen.has(target)) {
        seen.add(target);
        await hx(target, Ut(3));
      }
    }

    // 7. File upload — Uppy buttons, random markdown file
    for (const btn of document.querySelectorAll(".rc-UppyFileUploader button")) {
      btn.click();
      await sleep(500);
      const body = Ut(100);
      const file = new File([body], "session_" + Ut(10) + ".md", { type: "text/markdown" });
      const input = document.querySelector('input[type="file"]');
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      await sleep(2000);
    }

    // 8. Honor code + submit + confirm
    await sleep(2000);
    await waitForSelector('input[type="checkbox"], .rc-HonorCodeCheckbox, #agreement-checkbox-base', 1000)
      .then((el) => el.click())
      .catch(() => {});
    await waitForSelector(
      'button[aria-label="Submit"], button[data-e2e="submit-assignment"]', 2000)
      .then((el) => el.click())
      .catch(() => {});
    await sleep(2000);
    await waitForSelector(
      'button[data-e2e="dialog-submit"], button[data-track-component="submit_confirm"], button[data-testid="dialog-submit-button"]',
      2000)
      .then((el) => el.click())
      .catch(() => {});
    await sleep(2000);

    // 9. Chain request-grading ONLY when page discloses AI Grading
    try { if (hasAiGrading) await requestGradingByPeer(); } catch {}
  } catch (err) {
    console.error("Error handling peer-graded assignment:", err);   // verbatim
  }
}
```

## 7. Clone notes

- `requestGradingByPeer` = `d2` (v2.02). Chain runs only when `hD()` detected "AI Grading" — matches prototype `r && await d2()`.
- Prototype wraps in toast (`Un`) — clone uses logger + popup status (approved deviation).
- Every selector/step logged; missing optional elements (`.catch(()=>{})` in prototype) logged as debug, not thrown — same tolerance as prototype.
- `Cr()` vendor gate: not present in `mD` itself; only `d2` uses it (clone → noop + log).

## 8. Clone checklist

- [x] Full flow + helpers verified against bundle (this doc).
- [ ] Port `Ut` + `Vc` dictionary (3702 words) as `random-words.json`.
- [ ] Port `hx` (Slate fill), `hD` (AI-grading gate), inline `i()` helper.
- [ ] Wire popup action `submit-assignment` → `mD()`.
- [ ] Chain `d2()` gated by `hD()`.
