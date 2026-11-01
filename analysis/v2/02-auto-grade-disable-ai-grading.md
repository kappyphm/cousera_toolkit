# v2.02 — Auto Grade / Disable AI Grading (`d2 as requestGradingByPeer`)

Source: `prototype/assets/chunk-674d105d.js` `d2` @ 752402.
Decoder: `ln` (table `ua`, base 101, rotation (ua, 881730)).
Rubric helpers: `tC` @ 332273, `rC` @ 333310.

## 1. UI mapping

Three popup actions (reconstructed):
```js
isLoadingSubmitPeerGrading -> await mD(); // submit (v2.03)
isLoadingReview            -> await _D(); // review/grade peers (v2.03)
isLoadingDisableAI         -> await d2(); // this file
```

No standalone `autoGrade` or `disableAiGrading` flag exists in the bundle.

## 2. `d2 as requestGradingByPeer` — full logic

### 2.1 Guard + branch discovery

```js
if(!location[e(121)][e(143)](n[e(101)])){
  alert(n.ikMpm);
  return;
}
```

Decoded: `location.href.includes("/learn/")` → alert if not course page.

```js
const t=(x=document[e(117)](e(114)))==null?void 0:x[e(150)];
const r=t[e(130)](/(\d+~[A-Za-z0-9-_]+)/);
const i=r==null?void 0:r[1][e(144)]("~")[0];
```

Decoded:
- `e(117)` = `document.querySelector`
- `e(114)` = `"body > script:nth-child(3)"`
- `e(150)` = `.innerText`
- `e(130)` = `.match(/(\d+~[A-Za-z0-9-_]+)/)`
- `e(144)` = `.split("~")[0]`
- `i` = branchId (digits before `~`)

```js
const s=fg();
// s.course_id, s.item_id
```

`fg as getMetadata` @ 356668 — reads embedded course JSON from page header.

### 2.2 Resolve `submissionId` — REST

```js
const a=await n[e(124)](fetch,e(142)+i+"~"+s[e(139)]+"~"+s[e(133)]+"/?fields=deleteSubmission%2ClistSubmissions%2CreviewPeers%2CviewReviewSchema%2CanonymousPeerReview%2ConDemandPeerSubmissionProgresses.v1(latestSubmissionSummary%2ClatestDraftSummary%2ClatestAttemptSummary)%2ConDemandPeerReceivedReviewProgresses.v1(evaluationIfReady%2CearliestCompletionTime%2CreviewCount%2CdefaultReceivedReviewRequiredCount)%2ConDemandPeerDisplayablePhaseSchedules.v1(currentPhase%2CphaseEnds%2CphaseStarts)&includes=receivedReviewsProgress%2CsubmissionProgress%2CphaseSchedule")[e(151)](l=>l[e(156)]())[e(151)](l=>{var u,f,p;return(p=(f=(u=l[e(152)])==null?void 0:u[e(107)][0])==null?void 0:f[e(102)])==null?void 0:p[e(126)].id});
```

Decoded:
- `e(142)` = `https://www.coursera.org/api/onDemandPeerAssignmentPermissions.v1/` (from `ln(566)`)
- `s[e(139)]` = `s.course_id`
- `s[e(133)]` = `s.item_id`
- `e(151)` = `.then()`
- `e(156)` = `.json()`
- `e(152)` = `.linked`
- `e(107)` = `onDemandPeerSubmissionProgresses.v1`
- `e(102)` = `[0]` (array access)
- `e(126)` = `.latestSubmissionSummary`
- Result: `a = submissionId`

> **Errata (2026-11-01, live-verified):** the `e(102)` / `e(126)` labels above contradict the raw code printed in this same section — the `[0]` there is a literal inside the `f` assignment, so `e(102)` is a property hop on the entry, not the array access. The real permissions response (item `mzs3a`, course `7Sx79iWNEeWs4gorU6Q1Yw`, fetched 2026-11-01) shows the entry's `latestSubmissionSummary` is a wrapper `{ summary, computed }`: `summary` = { isAnonymous, isLate, context, isDraft, isMentorGraded, title } with NO `id`; `computed` = { createdAt, isDeleted, creatorId, id } carries the submission id. Verified chain: `linked["onDemandPeerSubmissionProgresses.v1"][0].latestSubmissionSummary.computed.id` — i.e. `e(102)` = `latestSubmissionSummary`, `e(126)` = `computed`. The GraphQL side was also live-confirmed: with `submissionId` missing, the gateway answers 400 naming `submissionId` as a required field of the input type, so the operation and schema match the bundle.

### 2.3 Force peer grading — GraphQL

Original mutation document (verbatim from `n.JpbYk`):

```graphql
mutation RequestGradingByPeer($input: PeerReviewAi_RequestGradingByPeerInput!) {
  PeerReviewAi_RequestGradingByPeer(input: $input) {
    submissionId
    __typename
  }
}
```

```js
Cr();
await fetch(n.bqFpc,{
  method:n[e(131)],
  headers:{"Content-Type":e(138)},
  body:JSON[e(111)]([{
    operationName:n[e(128)],
    variables:{
      input:{
        courseId:s[e(139)],
        itemId:s.item_id,
        submissionId:a,
        reason:n[e(149)]
      }
    },
    query:n[e(153)]
  }])
})[e(151)](l=>{
  if(l.status===200)location.reload()
}).catch(l=>console[e(135)](l));
```

Decoded:
- `n.bqFpc` = `ln(129)` = `https://www.coursera.org/graphql-gateway?opname=RequestGradingByPeer`
- `e(131)` = `"POST"`
- `e(138)` = `"application/json"`
- `e(111)` = `JSON.stringify`
- `e(128)` = `"RequestGradingByPeer"`
- `e(149)` = `ln(162)` = `"EXPECTED_HIGHER_SCORE|ok"`
- `e(153)` = the GraphQL mutation document string
- `Cr()` = vendor gate (clone replaces with noop/true)
- On status 200 → `location.reload()`

Note the **array envelope** (`[{...}]`) — required, not a bare object.

## 3. Rubric helpers (`tC`/`rC`)

### `tC(container)` @ 332273

Reads rubric UI:
- `[data-testid="rubric-options-list"] > div` — option rows
- `.css-1ast7yb`, `.css-152mfh`, `.css-132oxzc .css-g2bbpm` — score labels
- `.css-x3q7o9 > div:nth-child(2)`, `.rc-CML` — description text
- `div[role="group"]` — rubric groups

Returns `{ overview, rubricDetails: ["Title: desc", ...], feedback }`.

### `rC(code)` @ 333310

Builds prompt + POSTs to author server:
```js
const prompt =
  "Strict output rules:\n" +
  "- Use plain text...\n" +
  "- Avoid plagiarism...\n" +
  "Rubrics:\n" + JSON.stringify(z, null, 2) +
  "\nAssignment context:\nQuestion N: ...";
await fetch("https://cosemira.com/contribute", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code, content: p })
});
```

Hard-coded `https://cosemira.com/contribute` (see `v4/01-server-spec.md`).

## 4. Clone checklist (v2.02)

- [ ] No new flag; reuse `d2()` as "disable AI grading".
- [ ] Implement `branchId` regex on `body > script:nth-child(3)`.
- [ ] `GET PeerAssignmentPermissions -> submissionId`.
- [ ] `POST graphql-gateway?opname=RequestGradingByPeer` with array body + reload on 200.
- [ ] Optional rubric parser `tC()` for future auto-grade UI.
- [ ] Reason string: `"EXPECTED_HIGHER_SCORE|ok"`.
