# v4.01 — Server Spec (question/answer collection, Node.js replacement)

Source: `assets/chunk-67a65bb5.js` (`M as getSource`), `assets/chunk-674d105d.js` (`Cr`, `cC`, `uC`, `oD`, `rC`, `oC`), live `https://pear104.github.io/coursera-tool/metadata.json`.

This is the only version that needs a new backend. The clone replaces `https://cosemira.com` with a local Node.js mock first (`http://localhost:3000`), keeping wire format compatible so the real base can be swapped later via `metadata.url`.

## 1. `GET metadata.json` — dynamic base

Original content reference (verbatim context @340792):

```js
n={AqHgC:function(_,A){return _(A)},ALWyQ:function(_,A,I){return _(A,I)},PUXxH:"https://pear104.github.io/coursera-tool/metadata.json",...}
```

Live response (fetched 2026-10-12):

```json
{
  "url": "https://cosemira.com",
  "scriptPosition": 10,
  "ext": ["https://otieu.com/4/9795608"],
  "version": "1.0.8.5",
  "defaultDiscussionContent": "Very interesting course",
  "modelList": ["gemini-3.1-flash-lite","gemini-2.5-flash-lite","gemini-2.5-flash","gemma-4-31b-it"]
}
```

Semantics:

| Field | Used by | Meaning |
|---|---|---|
| `url` | background `M()`, content `oD()` | API base; full path = `url + "/check"` etc. |
| `ext` | background `M(r=true)` | Ad URLs opened with `openInBackground` when check fails. Empty disables ads. |
| `version` | popup | Update notice (`New Version Available`). |
| `modelList` | `nD/jz` | Fallback model when `storage.model` is empty; `[0]` is default. |
| `defaultDiscussionContent` | `vD` | Fallback discussion text. |
| `scriptPosition` | injector | Injection order hint for `script.js`. |

Mock:

```js
app.get("/metadata.json", (req, res) => res.json({
  url: "http://localhost:3000",
  scriptPosition: 10,
  ext: [],
  version: "1.0.8.5",
  defaultDiscussionContent: "Very interesting course",
  modelList: ["gemini-2.5-flash"]
}));
```

Note: `Cr/cC/rC` hard-code `https://cosemira.com/...` while `M/oD` use `metadata.url + path`. For local dev either hosts-redirect `cosemira.com -> 127.0.0.1` or patch the three hard-coded call sites to read the same base.

## 2. `POST /check` — boolean gate (out of clone scope, stub `true`)

Background `M(r=true)` concept:

```js
const M = async (r = true) => {
  try {
    const x = await fetch("https://pear104.github.io/coursera-tool/metadata.json").then((a) => a.json());
    const t = x["url"] + "/check"; // -> https://cosemira.com/check
    const { profileconsent: f, CAUTH: c, email: o } = await chrome.storage.local.get(["profileconsent", "CAUTH", "email"]);
    const u = await fetch(t, {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ CAUTH: c, profileconsent: f, email: o })
    }).then((a) => a.json()).catch((a) => false);
    const s = x["ext"];
    if (r) {
      if (u) return u;
      for (const a of s) await chrome.runtime.sendMessage({ action: "openInBackground", url: a });
    }
    return u;
  } catch { return false; }
};
```

Content `Cr as getSource` (~711314) is the lean variant (hard-coded, no ads):

```js
const Cr = async (e = true) => {
  const r = "https://cosemira.com/check";
  const { profileconsent: i, CAUTH: s, email: a } =
    await chrome.storage.local.get(["profileconsent", "CAUTH", "email"]);
  return await fetch(r, {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ CAUTH: s, profileconsent: i, email: a })
  }).then((l) => l.json()).catch((l) => false);
};
```

Wire spec:

```http
POST /check
Content-Type: application/json
Cache: no-store

{"CAUTH":"...","profileconsent":"...","email":"..."}
-> 200 application/json: true | false
```

`CAUTH`/`csrf3Token` originate from `chrome.cookies.get({url:"https://www.coursera.org"})`; `profileconsent/email/userId` from `userJson` JWT/DOM parsing. Missing values -> `false`.

Mock:

```js
app.post("/check", (req, res) => res.json(true));
```

## 3. `POST /quiz` — AES-encrypted answer bank

`cC(code)` concept:

```js
const cC = async (code) => {
  try {
    const r = "https://cosemira.com/quiz";
    const { profileconsent: i, CAUTH: s, email: a } =
      await chrome.storage.local.get(["profileconsent", "CAUTH", "email"]);
    const x = await fetch(r, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ CAUTH: s, profileconsent: i, code, email: a })
    }).then((u) => u.text());
    return await uC(x);
  } catch (e) { console.error(e); return []; }
};
```

`uC(cipherB64)` — WebCrypto AES-CBC decrypt (key/IV are plain base64 in the bundle):

```js
const KEY_B64 = "TqNSICj5KwtSjx6X8UdC/k/DdL8U+gJ6htGd6zCS7gU="; // 32 bytes
const IV_B64  = "FLOTuH1EBXTWNFVtHni0pQ==";                     // 16 bytes

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
```

Wire spec:

```http
POST /quiz
Content-Type: application/json

{"CAUTH":"...","profileconsent":"...","code":"<quiz-course-code>","email":"..."}
-> 200 text/plain: base64(AES-256-CBC-PKCS7(key, iv, JSON.stringify(value)))

value = [{ "term": "radio, <Q> |<a>|<b>", "definition": "<a>" }]
        | [] | { "error": "..." }
```

Node.js equivalent (must match browser `uC`):

```js
import crypto from "node:crypto";

const KEY = Buffer.from("TqNSICj5KwtSjx6X8UdC/k/DdL8U+gJ6htGd6zCS7gU=", "base64");
const IV = Buffer.from("FLOTuH1EBXTWNFVtHni0pQ==", "base64");

function encQuiz(value) {
  const c = crypto.createCipheriv("aes-256-cbc", KEY, IV);
  return Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]).toString("base64");
}

app.post("/quiz", (req, res) => {
  const { code } = req.body ?? {};
  const rows = db.getAnswers(code) ?? [];
  res.type("text/plain").send(encQuiz(rows));
});
```

Client test vector: `uC(encQuiz([{term:"radio, Q |a|b",definition:"a"}]))` must deep-equal the input.

## 4. `POST /contribute1004` (quiz) vs `POST /contribute` (peer)

Both accept `{code, content}` and only need `ok` status; no response body is consumed.

`oD(unmatched, code)` — quiz leftovers (base via metadata):

```js
const l = await fetch("https://pear104.github.io/coursera-tool/metadata.json").then((m) => m.json());
const h = l["url"] + "/contribute1004"; // -> https://cosemira.com/contribute1004
const terms = collected.map((m) => m?.term).filter(Boolean);
if (!terms?.length) return;
await fetch(h, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code, content: terms })
}).then((m) => {
  if (m.ok) toast.success("Correct answers collected successfully!");
  else toast.error("Failed to collect correct answers.");
}).catch(() => toast.error("Error occurred while collecting correct answers:"));
```

Collection enriches each term with `percent` (correct/total from `span[dir="ltr"]`) and page `url` before mapping to `term`.

`rC(code)` — peer rubrics (hard-coded):

```js
await fetch("https://cosemira.com/contribute", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code, content: p })
});
// p = [{ overview, rubricDetails: [...], feedback }] | [{ term, definition }]
// selectors: div[role=group], .rc-CML, .css-... rubric rows
```

Wire spec:

```http
POST /contribute1004
{"code":"...","content":["radio, Q |a|b", ...]}
-> 200 (any body; only .ok matters)

POST /contribute
{"code":"...","content":[{...}]}
-> 200
```

Mock:

```js
app.post(["/contribute1004", "/contribute"], (req, res) => {
  console.log(req.path, req.body?.code, req.body?.content?.length);
  res.sendStatus(200);
});
```

Storage model for v4:

```js
// answers: code -> [{ term, definition, url?, percent?, updatedAt }]
// review: stats per action for abuse monitoring
db.answers.upsert({ code, term }, { definition, url });
```

## 5. Function comparison (who calls what)

| Fn | Where | In | Out | Base | Ads |
|---|---|---|---|---|---|
| `M(r)` = background `getSource` | SW | `r` | `bool` | `GET metadata -> url + /check` | yes: `ext.forEach(openInBackground)` when `!u` |
| `Cr()` = content `getSource` | page | — | `bool` | hard-coded `.../check` | no |
| `cC(code)` | page | `code` | `[{term,definition}]` via `uC` | hard-coded `.../quiz` | no |
| `oD(_, code)` | page | `code + quiz DOM` | `fetch.ok` | `metadata.url + /contribute1004` | no |
| `rC(code)` | page | `code + peer DOM` | `fetch.ok` | hard-coded `.../contribute` | no |

## 6. Minimal Node.js scaffold (v4 target)

```js
import express from "express";
import crypto from "node:crypto";

const app = express().use(express.json({ limit: "2mb" }));
const KEY = Buffer.from("TqNSICj5KwtSjx6X8UdC/k/DdL8U+gJ6htGd6zCS7gU=", "base64");
const IV = Buffer.from("FLOTuH1EBXTWNFVtHni0pQ==", "base64");
const encQuiz = (v) => {
  const c = crypto.createCipheriv("aes-256-cbc", KEY, IV);
  return Buffer.concat([c.update(JSON.stringify(v), "utf8"), c.final()]).toString("base64");
};

app.get("/metadata.json", (req, res) => res.json({
  url: "http://localhost:3000", ext: [], version: "1.0.8.5",
  defaultDiscussionContent: "Very interesting course",
  modelList: ["gemini-2.5-flash"]
}));
app.post("/check", (req, res) => res.json(true));
app.post("/quiz", (req, res) => res.type("text/plain").send(encQuiz([])));
app.post(["/contribute1004", "/contribute"], (req, res) => res.sendStatus(200));
app.listen(3000);
```

Clone checklist:

- [ ] Implement routes above; keep `KEY/IV` identical so old clients still decrypt.
- [ ] Unify all clients on `metadata.url` base (remove 3 hard-coded hosts).
- [ ] Add persistence (`code -> terms`) + admin review before serving untrusted contributions.
- [ ] `ext: []` default; only add URLs deliberately.
