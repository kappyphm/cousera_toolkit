# v2.03 — Auto Peer Review (`mD`, `_D`, `Pd`)

Source: `prototype/assets/chunk-674d105d.js`:
- `mD as handlePeerGradedAssignment` @ 738051
- `_D as handleReview` @ 761766
- `Pd` review-one-item helper @ 757644

Decoders:
- `mD` uses `Mn` (table `aa`, base 276, rotation (aa, 667555))
- `_D` uses `Sn` (table `ca`, base 213, rotation (ca, 218))
- `Pd` uses `Ke` (table `xa`, base 267, rotation (xa, 732730))

## 1. Shared primitives

### Text insert helper `i(el, text)` (verbatim from `mD`)

```js
const i=async(u,f)=>{
  var g;
  const p=e;
  u&&(u[p(303)](),await ze(200),u.focus(),await n.mxdfF(ze,200),(g=u[p(321)])==null||g.call(u),
  document.execCommand(n[p(348)],![],f),
  await n.mxdfF(ze,200),
  u[p(337)]=f,
  u.dispatchEvent(new Event(n[p(360)],{bubbles:!![]})),
  u[p(356)](new Event(n[p(324)],{bubbles:!![]})));
};
```

Decoded sequence:
1. `el.click()` → sleep 200ms
2. `el.focus()` → sleep 200ms
3. `el.select?.()` (optional chaining)
4. `document.execCommand("insertText", false, text)`
5. sleep 200ms
6. `el.value = text`
7. `el.dispatchEvent(new Event("change", { bubbles: true }))`
8. `el.dispatchEvent(new Event("input", { bubbles: true }))`

### Random string generator `Ut(n)` (export `generateRandomString`)

Generates random alphanumeric strings of length `n`. Used for:
- `Ut(3)` — short filler text
- `Ut(10)` — filename suffix
- `Ut(100)` — file content body

### Editor insert helper `hx()` (from `mD` closure)

Uses `InputEvent` with `inputType: "insertText"` for contenteditable divs.

## 2. `mD` — submit peer-graded assignment

### 2.1 Editor trigger + sleep

```js
await se(n[e(327)])[e(307)](u=>u[e(303)]())[e(328)](u=>{});
await n[e(313)](ze,1e3);
```

Decoded:
- `se(selector)` — wait for main editor trigger
- `.then(el => el.click())` — click to open
- `sleep(1000)`

### 2.2 Title fill

```js
const t=n[e(298)];  // decoded: "Help me please! " (from mD config `zdkAx`)
const r=await n.zfULU(hD);  // hD = AI text variant (when available)
await n[e(325)](se,n[e(283)],1e3)[e(307)](async u=>{
  if(!u[f(337)]) await n[f(313)](ze,500),await i(u,t),await ze(500);
}).catch(()=>{});
```

Decoded:
- `n[e(283)]` = `#title, input[aria-label="Title"]`
- If `!el.value` → sleep 500 → fill with `t` → sleep 500
- Template text: `"Help me please! "` (config `zdkAx`)
- `hD()` = AI-generated text variant (when available)

### 2.3 Plain text inputs

```js
for(const u of document.querySelectorAll(n[e(276)])){
  const f=n[e(323)](Ut,3);
  !u[e(337)]&&await n.XcFic(i,u,f);
}
```

Decoded:
- `n[e(276)]` = `#main-container input[type=text]:not(#title)`
- `Ut(3)` = random 3-char string
- If `!el.value` → fill with random

### 2.4 Rich text editors

```js
for(const u of document[e(340)](n[e(301)]))
```

Decoded: `n[e(301)]` = `.rc-SubmissionPartEditor, .rc-RichTextMLEditor, .rc-CMLEditor`

For each editor:
- Find `[contenteditable=true]` child or use editor itself
- Deduplicate via `Set`
- Fill with `hx(target, Ut(3))`

### 2.5 Generic contenteditable/textarea/input fallback

```js
for(const el of document.querySelectorAll("[contenteditable=true], textarea, input")){
  if(!el.value) await i(el, Ut(3));
}
```

### 2.6 File upload via Uppy

```js
for(const btn of document.querySelectorAll(".rc-UppyFileUploader button")){
  btn.click(); await sleep(500);
  const f = Ut(100);
  const p = new File([f], "session_" + Ut(10) + ".md", { type: "text/markdown" });
  const g = document.querySelector('input[type="file"]');
  if(g){
    const d = new DataTransfer();
    d.items.add(p);
    g.files = d.files;
    g.dispatchEvent(new Event("change", { bubbles: true }));
  }
  await sleep(2000);
}
await sleep(2000);
```

### 2.7 Honor code + submit + confirm

```js
await se('input[type="checkbox"], .rc-HonorCodeCheckbox, #agreement-checkbox-base', 1000)
  .then(e=>e.click()).catch(()=>{});
await se('button[aria-label="Submit"], button[data-e2e="submit-assignment"]', 2000)
  .then(e=>e.click()).catch(()=>{});
await sleep(2000);
await se('button[data-e2e="dialog-submit"], button[data-track-component="submit_confirm"], button[data-testid="dialog-submit-button"]', 2000)
  .then(e=>e.click()).catch(()=>{});
await sleep(2000);
```

### 2.8 Chain to `d2()`

```js
try{ if(r) await d2(); } catch {}
```

After submit, chains `d2` (v2.02) to request peer grading.

### 2.9 Error handling

```js
catch(e){ console.error("Error handling peer-graded assignment:", e); }
```

## 3. `Pd` — grade one peer item

### 3.1 Review container wait

```js
await se(/* review container */, 1e3);
```

Decoded selector: `.css-2imjyh .css-7jkbgo a` (remaining count link)

### 3.2 Rubric group loop

```js
let s=document[e(323)](n[e(276)]);
for(const a of s){
  let x=a[e(274)](e(280));
  let l=Array.from(a[e(274)](n.umByr))[e(269)](f=>{
    const g=f[p(317)]==null?void 0:f[p(279)](/\d+/);
    return g?n[p(315)](parseInt,g[0],10):0;
  });
  if(n[e(283)](x[e(321)],0)){
    if(n[e(306)](l[0],l[n.IVFCe(x[e(321)],1)])){
      x[n[e(307)](x[e(321)],1)][e(277)]();
    } else {
      x[0][e(277)]();
    }
  }
}
```

Decoded:
- `n[e(276)]` = `div[role="group"]` — rubric groups
- `e(280)` = `.option-contents > div:nth-child(1)` — option containers
- `n.umByr` = `.peer-option-input .cds-checkboxAndRadio-label` — score labels
- Extract digits via `/\d+/` → parse to int
- If `Math.max(...nums) - Math.min(...nums) > 1` → pick last option
- Else → pick first option

### 3.3 Feedback textarea

```js
const u=a[e(274)](n[e(288)]);
for(let f of u){
  if(f[e(317)].length==1){
    f[e(277)]();
    f.focus();
    document[e(295)](n[e(292)],![],i);
  }
}
```

Decoded:
- `n[e(288)]` = `.c-peer-review-submit-textarea-input-field, div[data-testid="peer-review-multi-line-input-field"]`
- If `f.textContent.length == 1` → click, focus, `document.execCommand("insertText", false, "Good ")`
- Inserted text: literally `"Good "`

### 3.4 Submit button

```js
setTimeout(()=>{
  const x=(l=document[a(323)](a(290)))==null?void 0:l[0];
  const y=x[a(278)](n[a(327)]);
  y[a(297)]();
  y[a(277)]();
},700);
```

After 700ms: find submit button, scrollIntoView, click.

## 4. `_D` — review loop

### 4.1 Guard

```js
if(!location[e(220)][e(232)](n[e(222)])){
  alert(n[e(227)]);
  return;
}
```

Decoded: `location.pathname.includes("/learn/")` → alert if not course page.

### 4.2 Open course link

```js
n[e(225)](se,n.wyCST,1e3).then(r=>r[e(250)]())[e(238)](r=>{});
await new Promise(r=>setTimeout(r,1e3));
n[e(221)](se,n.wyCST,1e3)[e(226)](r=>r[e(250)]())[e(238)](r=>{});
n[e(225)](se,n[e(216)],1e3)[e(226)](r=>{r[e(250)]()})[e(238)](r=>{});
```

Decoded:
- `n.wyCST` = `button[data-js="open-course-link"]`
- `n[e(216)]` = `.css-2imjyh .css-7jkbgo a` (remaining count link)
- Click all three selectors, ignore errors

### 4.3 `/review/` page loop (max 5 rounds)

```js
let t="";
if(location.href[e(232)]("/review/")){
  let r=location.href,i=0;
  do{
    if(await n[e(253)](Pd),n[e(248)](location.href,r)){
      i++;
      r=location[e(220)];
    } else break;
  }while(i<5);
}
```

Decoded:
- If on `/review/` page
- Loop: call `Pd()` to grade one item
- If URL changed → increment counter, update href
- Else → break
- Max 5 iterations

### 4.4 "Left to complete" loop

```js
do{
  t=await n[e(221)](se,e(215),1e3).then(r=>r[e(239)])[e(238)](r=>{});
  await Pd();
  await new Promise(r=>setTimeout(r,2e3));
}while(t!=null&&t.includes(e(213)));
```

Decoded:
- `e(215)` = `[data-testid=review-count]` (remaining count element)
- `e(239)` = `.innerText`
- `e(213)` = `"left to complete"` (from `Sn(213)`)
- Loop: read remaining count → grade one item → sleep 2s
- Continue while count element exists AND contains "left to complete"

### 4.5 Vendor gate

```js
n[e(253)](Cr);
```

Calls `Cr as getSource` (vendor gate). Clone replaces with noop/true.

## 5. Clone checklist (v2.03)

- [ ] Port `i(el,text)` helper (click/focus/select/execCommand/value/dispatch).
- [ ] Port `hx()` editor helper (InputEvent inputType=insertText).
- [ ] Port `Ut(n)` random string generator.
- [ ] `mD()` with editor/title/file/honor/submit/confirm chain + `d2()` follow-up.
- [ ] `Pd()` rubric click (max-min > 1 → last, else first) + `"Good "` comment.
- [ ] `_D()` `/learn/` guard + `/review/` 5-round loop + `left to complete` loop.
- [ ] Template text: `"Help me please! "` (or AI via `hD()`).
