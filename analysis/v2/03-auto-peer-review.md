# v2.03 — Auto Peer Review (`mD`, `_D`, `Pd`)

Source: `assets/chunk-674d105d.js`:
- `mD as handlePeerGradedAssignment` (~738051)
- `_D as handleReview` (~761766)
- `Pd` review-one-item helper (~757644)

## 1. Shared primitives

```js
const i = async (el, text) => {
  el.click(); await sleep(200);
  el.focus(); await sleep(200);
  el.select?.();
  document.execCommand("insertText", false, text);
  await sleep(200);
  el.value = text;
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
```

Selectors (decoded):

- `#title, input[aria-label="Title"]`
- `#main-container input[type="text"]:not(#title)`
- `.rc-SubmissionPartEditor, .rc-RichTextMLEditor, .rc-CMLEditor`
- `[contenteditable="true"]`, `textarea`
- `div[role="tablist"] button:nth-child(2)`
- `.rc-UppyFileUploader button`
- `input[type="file"]`
- Honor: `input[type="checkbox"], .rc-HonorCodeCheckbox, #agreement-checkbox-base`
- Submit: `button[aria-label="Submit"], button[data-e2e="submit-assignment"]`
- Confirm: `button[data-e2e="dialog-submit"], button[data-track-component="submit_confirm"], button[data-testid="dialog-submit-button"]`

Random filler: `Ut(n, joiner)` generates random strings (`Ut(3)`, `Ut(10)`, `Ut(100)`).

## 2. `mD` — submit peer-graded assignment

```js
const mD = async () => {
  try {
    await se(/* main editor trigger */).then((el) => el.click()).catch(() => {});
    await sleep(1000);

    const t = "Help me please! "; // template answer text (table aa)
    // const r = await hD(); // AI text variant (when available)

    // title / plain inputs
    await se(/* title selector */, 1000).then(async (el) => {
      if (!el.value) await i(el, t);
    }).catch(() => {});

    for (const el of document.querySelectorAll("#main-container input[type=text]:not(#title)")) {
      if (!el?.isConnected) continue;
      if (!el.value) await i(el, Ut(3));
    }

    // rich editors
    const seen = new Set();
    const editors = document.querySelectorAll(
      ".rc-SubmissionPartEditor, .rc-RichTextMLEditor, .rc-CMLEditor"
    );
    for (const ed of editors) {
      const target = ed.querySelector("[contenteditable=true]") || ed;
      if (!target?.isConnected || seen.has(target)) continue;
      seen.add(target);
      await hx(target, Ut(3)); // hx() uses InputEvent inputType=insertText
    }

    // generic contenteditable/textarea/input fallback
    for (const el of document.querySelectorAll("[contenteditable=true], textarea, input")) {
      if (!el.value) await i(el, Ut(3));
    }

    // file upload via Uppy
    for (const btn of document.querySelectorAll(".rc-UppyFileUploader button")) {
      btn.click(); await sleep(500);
      const f = Ut(100);
      const p = new File([f], "session_" + Ut(10) + ".md", { type: "text/markdown" });
      const g = document.querySelector('input[type="file"]');
      if (g) {
        const d = new DataTransfer();
        d.items.add(p);
        g.files = d.files;
        g.dispatchEvent(new Event("change", { bubbles: true }));
      }
      await sleep(2000);
    }
    await sleep(2000);

    await se('input[type="checkbox"], .rc-HonorCodeCheckbox, #agreement-checkbox-base', 1000)
      .then((e) => e.click()).catch(() => {});
    await se('button[aria-label="Submit"], button[data-e2e="submit-assignment"]', 2000)
      .then((e) => e.click()).catch(() => {});
    await sleep(2000);
    await se('button[data-e2e="dialog-submit"], button[data-track-component="submit_confirm"], button[data-testid="dialog-submit-button"]', 2000)
      .then((e) => e.click()).catch(() => {});
    await sleep(2000);

    try { if (r) await d2(); } catch {}
  } catch (e) {
    console.error("Error handling peer-graded assignment:", e);
  }
};
```

Note: after submit it chains `d2()` (v2.02) to request peer grading.

## 3. `Pd` — grade one peer item

Decoded selectors:

- `.c-peer-review-submit-textarea-input-field, div[data-testid="peer-review-multi-line-input-field"]`
- `.option-contents > div:nth-child(1)`
- `.peer-option-input .cds-checkboxAndRadio-label`
- `.rc-FormPart`

```js
const Pd = async () => {
  await se(/* review container */, 1000);
  const groups = document.querySelectorAll(/* rubric groups */);
  for (const g of groups) {
    const opts = g.querySelectorAll(/* radio options */);
    const nums = Array.from(g.querySelectorAll(/* score labels */))
      .map((f) => parseInt(f.textContent.match(/\d+/)));
    // picks last option when spread is large, else first:
    const pick = (Math.max(...nums) - Math.min(...nums) > 1)
      ? opts[opts.length - 1] : opts[0];
    pick.click();
    const box = g.querySelector("textarea, [data-testid=peer-review-multi-line-input-field]");
    if (box) {
      box.focus();
      document.execCommand("insertText", false, "Good ");
      box.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await sleep(700);
  }
};
```

Inserted review text is literally `"Good "`.

## 4. `_D` — review loop

```js
const _D = async () => {
  if (!location.pathname.includes("/learn/")) {
    alert("This is not a course page...");
    return;
  }
  await se('button[data-js="open-course-link"]', 1000)
    .then((r) => r.click()).catch(() => {});
  await sleep(1000);

  if (location.href.includes("/review/")) {
    let href = location.href, n = 0;
    do {
      await Pd();
      if (location.href !== href) { n++; href = location.href; }
      else break;
    } while (n < 5);
  }

  let t = "";
  do {
    t = await se(/* remaining-count selector */, 1000)
      .then((r) => r.innerText).catch(() => null);
    await Pd();
    await sleep(2000);
  } while (t != null && t.includes("left to complete"));

  Cr(); // vendor gate; clone replaces with noop/true
};
```

Decoded selectors in loop: `.css-2imjyh .css-7jkbgo a`, `[data-testid=review-count]`.

## 5. Clone checklist (v2.03)

- [ ] Port `i(el,text)` + `hx()` editor helper + `Ut()`.
- [ ] `mD()` with editor/title/file/honor/submit/confirm chain + `d2()` follow-up.
- [ ] `Pd()` rubric click + `"Good "` comment.
- [ ] `_D()` `/learn/` guard + `/review/` 5-round loop + `left to complete` loop.
