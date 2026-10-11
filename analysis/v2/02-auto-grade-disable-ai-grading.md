# v2.02 — Auto Grade / Disable AI Grading (`d2 as requestGradingByPeer` + rubric helpers)

Source: `assets/chunk-674d105d.js` `d2` (~752402), rubric helpers `tC/rC` (~328472+). There is **no** standalone `autoGrade` or `disableAiGrading` flag in the bundle; the UI's "Disable AI" button maps to `d2`, i.e. forcing a human peer-grading round via GraphQL.

## 1. UI mapping

Three popup actions (reconstructed):

```js
isLoadingSubmitPeerGrading -> await mD(); // submit (v2.03)
isLoadingReview            -> await _D(); // review/grade peers (v2.03)
isLoadingDisableAI         -> await d2(); // this file
```

## 2. `d2 as requestGradingByPeer` — full logic

### 2.1 Guard + branch discovery

```js
if (!location.href.includes("/learn/")) {
  alert("This is not a course page...");
  return;
}
```

Original `d2` head (verbatim, obfuscated):

```js
const d2=async()=>{var x;const e=ln,n={JxyDR:function(l,u){return l(u)},ikMpm:e(140),FYjIk:function(l,u){return l===u},YYFpo:e(122),plIvf:e(125),aARpG:function(l,u){return l!==u},qtFBp:e(106),bqFpc:e(129),ykzRD:e(118),NkREO:e(119),aaLSi:e(162),JpbYk:`mutation RequestGradingByPeer($input: PeerReviewAi_RequestGradingByPeerInput!) {
  PeerReviewAi_RequestGradingByPeer(input: $input) {
    submissionId
    __typename
  }
}
`};
```

Branch ID comes from an embedded script tag:

```js
const t = document.querySelector("body > script:nth-child(3)")?.innerText;
const r = t.match(/(\d+~[A-Za-z0-9-_]+)/);
const i = r?.[1].split("~")[0]; // branchId = digits before "~"
```

Course/item comes from the shared helper:

```js
const s = fg();
// s.course_id, s.item_id  (see analysis/README.md)
```

### 2.2 Resolve `submissionId` — REST

```http
GET https://www.coursera.org/api/onDemandPeerAssignmentPermissions.v1/<branchId>~<courseId>~<itemId>/?fields=deleteSubmission%2ClistSubmissions%2CreviewPeers%2CviewReviewSchema%2CanonymousPeerReview%2ConDemandPeerSubmissionProgresses.v1(latestSubmissionSummary%2ClatestDraftSummary%2ClatestAttemptSummary)%2ConDemandPeerReceivedReviewProgresses.v1(evaluationIfReady%2CearliestCompletionTime%2CreviewCount%2CdefaultReceivedReviewRequiredCount)%2ConDemandPeerDisplayablePhaseSchedules.v1(currentPhase%2CphaseEnds%2CphaseStarts)&includes=receivedReviewsProgress%2CsubmissionProgress%2CphaseSchedule
-> .linked.onDemandPeerSubmissionProgresses.v1[0].latestSubmissionSummary.id
```

```js
const a = await fetch(
  "https://www.coursera.org/api/onDemandPeerAssignmentPermissions.v1/" +
    i + "~" + s.course_id + "~" + s.item_id + "/?fields=..."
).then((l) => l.json())
 .then((l) => l.linked.onDemandPeerSubmissionProgresses.v1[0].latestSubmissionSummary.id);
```

### 2.3 Force peer grading — GraphQL

Original mutation document (verbatim from `JpbYk`):

```graphql
mutation RequestGradingByPeer($input: PeerReviewAi_RequestGradingByPeerInput!) {
  PeerReviewAi_RequestGradingByPeer(input: $input) {
    submissionId
    __typename
  }
}
```

```http
POST https://www.coursera.org/graphql-gateway?opname=RequestGradingByPeer
Content-Type: application/json

[
  {
    "operationName": "RequestGradingByPeer",
    "variables": {
      "input": {
        "courseId": "<course_id>",
        "itemId": "<item_id>",
        "submissionId": "<a>",
        "reason": "EXPECTED_HIGHER_SCORE|ok"
      }
    },
    "query": "mutation RequestGradingByPeer... (above)"
  }
]
-> if (status === 200) location.reload()
```

Note the array envelope (`[ {...} ]`) — required, not a bare object.

## 3. Rubric helpers (`tC`/`rC`) — grading assistance context

Selectors (decoded):

- `[data-testid="rubric-options-list"] > div`
- `.css-1ast7yb`, `.css-152mfh`, `.css-132oxzc .css-g2bbpm`
- `.css-x3q7o9 > div:nth-child(2)`, `.rc-CML`
- `div[role="group"]`

```js
// tC(container) -> { overview, rubricDetails: ["Title: desc", ...], feedback }
const tC = (e) => {
  // reads overview textContent.trim(), rubric rows, feedback box
};

// rC(code) builds prompt + POSTs to author server:
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

`rC` uses hard-coded `https://cosemira.com/contribute` (see `v4/01-server-spec.md`).

## 4. Clone checklist (v2.02)

- [ ] No new flag; reuse `d2()` as "disable AI grading".
- [ ] Implement `branchId` regex on `body > script:nth-child(3)`.
- [ ] `GET PeerAssignmentPermissions -> submissionId`.
- [ ] `POST graphql-gateway?opname=RequestGradingByPeer` with array body + reload on 200.
- [ ] Optional rubric parser `tC()` for future auto-grade UI.
