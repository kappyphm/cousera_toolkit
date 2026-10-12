# v2.03 — Auto Peer Review (`_D as handleReview`, `Pd`)

Source: `prototype/assets/chunk-674d105d.js`:
- `_D as handleReview` @ 761766
- `Pd` review-one-item helper @ 757644 (called from `_D` loop)

> Note: `mD as handlePeerGradedAssignment` (submit side) moved to `01-auto-submit-assignment.md`.

Decoders:
- `_D` uses `Sn` (table `ca`, base 213, rotation (ca, 218))
- `Pd` uses `Ke` (table `xa`, base 267, rotation (xa, 732730))

## 1. Trigger (in-page panel, prototype)

```js
// @347210
isLoadingReview:!![],
Un(async()=>{await _D()},{loading:"Grading ...",success:...})
```

Button `isLoadingReview` → toast `"Grading ..."` → `await _D()`. Clone wires popup action `review-peers`.

## 2. Shared primitives (used by `Pd`)

### Text insert helper `i(el, text)` (verbatim from doc 01 §5.4 — same inline helper)

Click → sleep 200 → focus → sleep 200 → `select?.()` → `execCommand("insertText")` → sleep 200 → set `value` → dispatch `change` + `input`.

### Random string generator `Ut(n)` (export `generateRandomString`)

Random **words** from the `Vc` dictionary (3702 entries, table `Ds` base 156). Used for:
- `Ut(3)` — short filler text
- `Ut(10)` — filename suffix
- `Ut(100)` — file content body

### Editor insert helper `hx()` (Slate.js fill)

See `01-auto-submit-assignment.md` §5.2. Uses `InputEvent` with `inputType: "insertText"` for contenteditable divs.

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
- [ ] Port `Ut(n)` random word generator.
- [ ] `Pd()` rubric click (max-min > 1 → last, else first) + `"Good "` comment.
- [ ] `_D()` `/learn/` guard + `/review/` 5-round loop + `left to complete` loop.
- [ ] Popup action `review-peers` → `_D()`.
