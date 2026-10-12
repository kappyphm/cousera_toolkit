# v3.01 — AI Auto Quiz (`x2`, `rD`, `nD`, `jz`, `Qz`, `Yc`, `u2`, `Et`, `TD`, `oD`, `cC`, `uC`)

Source: `assets/chunk-674d105d.js`. Fill+submit entry `x2 as handleAutoquiz`; submit orchestration verified in Appendix A below; this file is the answering engine.

Pipeline:

```
DOM --px()--> server match (cC/uC) --unmatched--> Gemini (nD/jz/Qz/Yc) --answers--> fill (u2/Et) --leftover--> collect/upload (TD/oD)
```

## 1. Selectors + normalize

Decoded container selector (used by `querySelectorAll`):

```css
.css-1hhf6i, .rc-FormPartsQuestion
```

Question/option selectors:

```css
.css-x3q7o9 > div:nth-child(2), .rc-CML
.rc-Option
.parts > div
figure > img, img[src]
[data-testid="input-area"] input
input, textarea, input[type="text"], input[type="number"]
.rc-SubmissionPartEditor, .rc-RichTextMLEditor, .rc-CMLEditor
[contenteditable="true"]
```

`px as extendStringPrototype` overrides `String.prototype.normalize` (decoded behavior):

```js
String.prototype.normalize = function () {
  return this
    .replaceAll(" ", "")        // NBSP artifact
    .replace(/\s+/g, " ")
    .replaceAll("\n", " ")
    .replaceAll("“", '"').replaceAll("”", '"')
    .replaceAll("‘", "'").replaceAll("’", "'")
    .replaceAll("–", "-").replaceAll("—", "-")
    .replaceAll("…", "...")
    .replaceAll("Gemini", "").replaceAll("FPT", "")
    .trim();
};
```

Every matcher calls `px()` first.

## 2. Server answers — `cC` + `uC` (AES)

`cC(code)` posts auth + course code and decrypts the text response. Concept (endpoint hard-coded in bundle; `code` = course identifier from `fg()`):

```http
POST https://cosemira.com/quiz
Content-Type: application/json

{"CAUTH":"...","profileconsent":"...","code":"<courseCode>","email":"..."}
-> 200 text/plain: base64(AES-256-CBC(JSON.stringify([{term,definition}])))

catch -> []
```

`uC(cipherB64)` (verbatim concept, key/IV are plain base64 in bundle):

```js
// decoded constants:
const KEY_B64 = "TqNSICj5KwtSjx6X8UdC/k/DdL8U+gJ6htGd6zCS7gU="; // 32 B AES-256
const IV_B64  = "FLOTuH1EBXTWNFVtHni0pQ==";                     // 16 B

async function uC(e) {
  const s = Uint8Array.from(atob(KEY_B64), (u) => u.charCodeAt(0));
  const a = Uint8Array.from(atob(IV_B64), (u) => u.charCodeAt(0));
  const x = await crypto.subtle.importKey("raw", s, { name: "AES-CBC" }, false, ["decrypt"]);
  const l = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: a },
    x,
    Uint8Array.from(atob(e), (u) => u.charCodeAt(0))
  );
  return JSON.parse(new TextDecoder().decode(l));
}
// -> [{ term, definition }] | [] ; caller bails if u?.error
```

Decrypted shape: `[{ term: "radio, <question> |<opt1>|<opt2>", definition: "<answer>" }]`.

## 3. Matching — `rD(domList, serverAnswers)`

```js
const rD = async (containers, answers) => {
  px();
  const { geminiAPI } = await chrome.storage.local.get("geminiAPI");
  const unmatched = [];

  containers.forEach((a) => {
    const qEl = a.querySelector(".css-x3q7o9 > div:nth-child(2), .rc-CML");
    const img = a.querySelector("figure > img, img")?.src?.split("?")[0];
    const g = ((qEl?.innerText ?? "") + (img ? " " + img : "")).normalize().toLowerCase();

    const m = answers?.filter((B) => {
      const T = B?.term;
      if (T == null) return false;
      const hit = B.term.normalize().includes(g) || g.includes(B.term.normalize());
      const urlScoped = T.includes("...") ? B.term.includes(location.href) : true;
      return hit && urlScoped;
    });

    if (m?.length) {
      for (const B of m) {
        for (const opt of a.querySelectorAll(".rc-Option")) {
          const txt = opt.querySelector("span:nth-child(2), .rc-CML")?.innerText.normalize() ?? "";
          const src = opt.querySelector("img")?.src ?? "";
          const A = (txt + " " + src).normalize();
          const input = opt.querySelector("input");
          if (!input) continue;
          if (!B.definition.normalize().includes(A) && !A.includes(B.definition.normalize())) continue;
          if (input.type === "radio") { input.click(); Et(input, "OK"); }
          if (input.type === "checkbox") { /* split definition by "|" then click each verbatim */ }
          if (input.type === "text") {
            input.click();
            input.value = B.definition;
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      }
    } else {
      unmatched.push(a);
    }
  });

  if (unmatched.length) {
    if (geminiAPI) return await nD(unmatched, "Gemini");
    await u2(containers, unmatched, ...);
  }
  return unmatched;
};
```

Key points: two-way `includes` on normalized text; image `src` participates; radio/checkbox/text handled separately with `click()` + `change` event + `Et()` badge.

## 4. AI fallback — `nD`, `jz`, `Qz`, `Yc`

Storage + model resolution:

```js
const { geminiAPI } = await chrome.storage.local.get("geminiAPI");
const { model } = await chrome.storage.local.get("model");
const x = model
  ?? (await fetch("https://pear104.github.io/coursera-tool/metadata.json").then((r) => r.json())).modelList[0];
```

Verified plain hits for `geminiAPI` context:

```js
// @296348
const gv=()=>{const[e,n]=q.useState({geminiAPI:""});return{apiKeys:e,setApiKeys:n}}
```

Live `metadata.json`:

```json
{
  "url": "https://cosemira.com",
  "modelList": ["gemini-3.1-flash-lite","gemini-2.5-flash-lite","gemini-2.5-flash","gemma-4-31b-it"]
}
```

Prompt builder `Qz(containers)`:

```js
// per container:
{
  term: inputType + ", " + question + " |" + choices.map((c) => c.innerText.normalize() + (img ? " " + img : "")).join("|"),
  definition: ""
}
// e.g. "radio, What is...? |opt1|opt2"
```

System instruction `Yc` (decoded essence, 9 rules):

```
You are given a JSON array. Extract the correct answer from "term" (options separated by "|") into "definition".
1. Return ONLY raw JSON array.
2. definition must be VERBATIM copy of the chosen option.
3. Preserve punctuation / trailing dots / brackets.
4. radio: exactly 1; checkbox: join all with "|"; text: concise.
5. Escape " as \".
```

SDK call (`l2` = bundled `GoogleGenAI`):

```js
const s = new l2({ apiKey: geminiAPI });
const schema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      term: { type: "string", description: "Formatted string: 'radio, [Question] | [Choice 1] | ...'" },
      definition: { type: "string", description: "Correct content of the answer" }
    },
    required: ["term", "definition"]
  }
};

let h;
try {
  h = await s.models.generateContent({
    model: x,
    contents: JSON.stringify(Qz(containers)),
    config: {
      thinkingConfig: { includeThoughts: false, thinkingLevel: "MINIMAL" },
      responseMimeType: "application/json",
      systemInstruction: Yc,
      responseJsonSchema: schema
    }
  });
} catch {
  h = await s.models.generateContent({
    model: x,
    contents: JSON.stringify(Qz(containers)),
    config: { responseMimeType: "application/json", systemInstruction: Yc, responseJsonSchema: schema }
  });
}
const m = JSON.parse(h.text || "[]");
await u2(containers, m, "Gemini");
```

Direct endpoint (from bundled SDK, verified plain):

```js
s.baseUrl = "https://generativelanguage.googleapis.com/";
// + "API key should be set when using the Gemini API."
```

Calls go straight to `.../v1beta/models/...:generateContent?key=` with `x-goog-api-key`; background is not proxied. Missing key throws `"Gemini API key is missing in storage."`.

Multi-provider note for clone: the badge map already supports `FPT/ChatGPT/Gemini/DeepSeek/OK`; keep `AIProvider` interface and add per-vendor `solve()` while reusing `Qz/Yc/u2`.

## 5. Fill + badge — `u2`, `Et`

```js
// Et(label, source): colored badge deduped by .badge[data-text="<source>"]
const colors = { FPT: "#f54e00", ChatGPT: "#ffc107", Gemini: "#0263f5", DeepSeek: "#dc3545", OK: "#f54e00" };
if (!label.closest('.badge[data-text="' + source + '"]')) {
  const l = document.createElement("span");
  l.textContent = source;
  l.className = "badge font-bold";
  l.style.backgroundColor = colors[source];
  l.setAttribute("data-text", source);
  label.appendChild(l);
}
```

`u2` fills radio/checkbox via `click()+Et()`, text via `value + change/input` events, including `[contenteditable]` and `.rc-SubmissionPartEditor` variants.

## 6. Collect leftover — `TD`, `oD`

`TD as collectUnmatchedQuestion(container, pushArr)`:

```js
const s = container.querySelector(".css-x3q7o9 > div..., .rc-CML");
const a = s?.innerText.normalize() ?? "";
const x = container.querySelectorAll(".rc-Option");
pushArr.push({
  term: "Quiz type: " + x[0]?.getAttribute(...) + ", " + a + " | " + Array.from(x).map((h) => h.innerText...).join(" | "),
  definition: ""
});
// + clicks first option, fills random Ut(10," ") into input/textarea, dispatches change/input
```

`oD(unmatched, code)` uploads after submit (endpoint via metadata, see v4):

```js
const l = await fetch("https://pear104.github.io/coursera-tool/metadata.json").then((m) => m.json());
const h = l["url"] + "/contribute1004"; // -> https://cosemira.com/contribute1004
await fetch(h, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code, content: terms })
}).then((m) => {
  m.ok ? toast.success("Correct answers collected successfully!")
       : toast.error("Failed to collect correct answers.");
});
```

## 7. Coursera-internal AI channel (supplementary)

```js
const xD = "https://www.coursera.org/graphql-gateway?opname=AiCoach_CreateUserMessageAndReturnResponse";
const Id = async ({ userId, courseId, itemId, branchId, message, action }) =>
  fetch(xD, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    operationName: "AiCoach_CreateUserMessageAndReturnResponse",
    variables: { recommendedActionsEnabled: true, clipRecommendationsEnabled: false,
      input: { userId, message, courseraContext: { courseId, itemId, courseBranchId: branchId }, mode: "COACH_ITEM", action } },
    query: cD }) });
```

Uses `CAUTH/CSRF3-Token`, no Gemini key. Quiz path does not depend on it; keep for discussion/assignment assist.

## 8. Clone checklist (v3.01)

- [ ] Port `px()`, selectors, two-way matcher.
- [ ] Stub `/quiz` + `uC()` decrypt (keep key/IV for compat).
- [ ] `AIProvider` with Gemini first; `Qz/Yc/schema` verbatim behavior.
- [ ] `u2/Et` fill + badges; `TD/oD` collect/upload.

## Appendix A — `x2 as handleAutoquiz` submit orchestration (verified)

Source: `x2` @ 705766–709520 (body len 3754). Decoder `sn` (table `na`, base 345, rotation (na, 649582)).
Trigger: in-page panel button (`@348754`: `onClick: await x2(u, m)`) **and** auto-run on URL condition (`@323018`: `... && await x2(w, l)`).

### A.1 Toast config (corrected)

Wrapper `Un("promise")(fn, {loading, success, error})`:

```js
{ loading: "Processing quiz...",   // sn(349)
  success: "Quiz completed!",      // sn(365)
  error:   "Failed to process quiz" }  // sn(334)  [corrects earlier claim of sn(392)]
```

### A.2 Storage + guards (verified sequence)

```js
const { isAutoSubmitQuiz: flag } = await chrome.storage.local.get("isAutoSubmitQuiz");

// Not on /attempt → start-attempt path
if (!location.href.includes("/attempt")) {
  await waitForSelector(CoverPageActionButton /* sn(411) */, 3_600_000)
    .then((btn) => btn.click()).catch(() => {});
  let overlay = document.querySelector('[data-testid="tunnel-vision-content"]');  // r.Rqxdz
  for (; !overlay;) {
    await sleep(1000);
    await waitForSelector(StartAttemptModalPrimary /* sn(357) */, 1000)
      .then((btn) => btn.click()).catch(() => {});
    overlay = document.querySelector('[data-testid="tunnel-vision-content"]');
    setState((s) => ({ ...s, isLoadingQuiz: true }));
  }
}
if (location.href.includes("/view-feedback")) return;   // sn(356)
await waitForSelector(".css-1hhf6i, .rc-FormPartsQuestion" /* sn(346) */, 20_000).catch(() => {});
document.querySelector('button[aria-label="Back"]')?.addEventListener("click", () => window.history.back());
await waitForSelector('.rc-CodeBlock, .icon-container, [data-testid="action-feedback-icon-container"]' /* sn(409) */, 2000)
  .then(async (el) => { if (el) await sleep(5000); }).catch(() => {});
```

### A.3 Fill + submit (verified)

```js
const questions = document.querySelectorAll(".css-1hhf6i, .rc-FormPartsQuestion");
const answers = await collectAnswers(code);           // cC → cosemira / AI (this doc)
if (answers?.error) return;
const filled = await fillQuestions(questions, answers); // rD
setState((s) => ({ ...s, isLoadingQuiz: false }));

await waitForSelector("#agreement-checkbox-base" /* sn(403) */, 6000).then((el) => el.click()).catch(() => {});
await sleep(2000);

if (flag ?? false) {
  // confirm dialog loop
  let dialog = document.querySelector(".cds-Dialog-dialog");
  await waitForSelector('[data-testid="input-area"] input' /* sn(363) */, 2000)
    .then((el) => { el.click(); el.dispatchEvent(new Event("input", { bubbles: true })); }).catch(() => {});
  for (; !dialog;) {
    await waitForSelector('button[data-testid="submit-button"], button[data-test="submit-button"]' /* sn(380) */, 10_000)
      .then((el) => el.click()).catch(() => {});
    await sleep(1000);
    dialog = document.querySelector(".cds-Modal-container");
  }
  await waitForSelector('button[data-testid="dialog-submit-button"]' /* literal OmMPP */, 10_000)
    .then((el) => el.click()).catch(() => {});
  if (!filled || filled.length == 0) return;          // mvQAW loose-equal
  let tv = document.querySelector('[data-testid="tunnel-vision-content"]');
  for (; tv;) await sleep(1000), tv = document.querySelector('[data-testid="tunnel-vision-content"]');
  await sleep(2000);
  await waitForSelector('button[data-testid="view-feedback-button"]' /* sn(381) */);
  document.querySelector('button[data-testid="view-feedback-button"]')?.click();
  await uploadResults(filled, code);                   // oD → v4 server
}
setState((s) => ({ ...s, isLoadingQuiz: false }));
```

Note: `for (;!dialog;)` has no cap in prototype (infinite 1s click loop if confirm never appears). Clone must log each iteration.
