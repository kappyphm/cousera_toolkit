# v1.01 — Skip Video / Reading (`dD as resolveWeekMaterial`)

Source: `assets/chunk-674d105d.js` (~727970+), exported as `dD as resolveWeekMaterial`.

## 1. Entry / UX

The popup sets a loading flag, awaits `dD()`, sleeps, then reloads:

```js
// caller pattern (reconstructed from bundle)
set(isLoadingCompleteWeek = true);
await resolveWeekMaterial(); // dD()
set(isLoadingCompleteWeek = false);
await sleep(1000);
location.reload();
```

Toast uses a `toast.promise` wrapper (`Un`):

- `loading: "Skipping Videos & Readings"`
- `success: "Skip Videos & Readings Completed!"`
- `error: "Skipping failed!"`

When lecture items exist, a progress toast is shown:

```js
// style/border + position are obfuscated table lookups; decoded values:
style: { border: "1px solid #0356fc" },
position: "top-right"
// body:
<div>Progress: <span id="progress">0</span>/{total}</div>
```

Updater:

```js
const f = (v) => {
  document.getElementById("progress").innerHTML = "" + v;
};
```

## 2. Course discovery — `c2()`

Original concept (identifiers obfuscated, strings partially decoded):

```js
// slug: 5th segment of /learn/<slug>/...
const t = window.location.href.split("/")[4];

// EXACT strings decoded from prototype `Bn()` (table `ra`, base 215, rotation (ra,191423)):
// Bn(218) = "https://www.coursera.org/api/onDemandCourseMaterials.v2/?q=slug&slug="
// Bn(227) = "&includes=modules%2Clessons%2CpassableItemGroups%2CpassableItemGroupChoices%2CpassableLessonElements%2Citems%2Ctracks%2CgradePolicy%2CgradingParameters%2CembeddedContentMapping&fields=moduleIds%2ConDemandCourseMaterialModules.v1(name%2Cslug%2Cdescription%2CtimeCommitment%2ClessonIds%2Coptional%2ClearningObjectives)%2ConDemandCourseMaterialLessons.v1(name%2Cslug%2CtimeCommitment%2CelementIds%2Coptional%2CtrackId)%2ConDemandCourseMaterialPassableItemGroups.v1(requiredPassedCount%2CpassableItemGroupChoiceIds%2CtrackId)%2ConDemandCourseMaterialPassableItemGroupChoices.v1(name%2Cdescription%2CitemIds)%2ConDemandCourseMaterialPassableLessonElements.v1(gradingWeight%2CisRequiredForPassing)%2ConDemandCourseMaterialItems.v2(name%2CoriginalName%2Cslug%2CtimeCommitment%2CcontentSummary%2CisLocked%2ClockableByItem%2CitemLockedReasonCode%2CtrackId%2ClockedStatus%2CitemLockSummary)%2ConDemandCourseMaterialTracks.v1(passablesCount)%2ConDemandGradingParameters.v1(gradedAssignmentGroups)%2CcontentAtomRelations.v1(embeddedContentSourceCourseId%2CsubContainerId)&showLockedItems=true"
// NOTE: `includes` must contain `items` and `fields` must request
// `contentSummary` — otherwise `linked.onDemandCourseMaterialItems.v2`
// is absent (root cause of the first v1 run failure).
const r = await fetch(Bn218 + t + Bn227).then((l) => l.json());

const data = r?.linked?.["onDemandCourseMaterialItems.v2"];
const courseId = r?.linked?.["onDemandCourseMaterialGradePolicy.v1"]?.[0]?.id;
return { data, courseId, slug: t };
```

Verified verbatim context around the next stage (plain strings):

```js
{data:t,courseId:r,slug:i}=await n[e(398)](c2),{userId:s}=await chrome[e(303)].local[e(406)](n[e(337)]),a=await n.QKUPU(Cr,![]),x=(y=document[e(395)].match(/(?:^|;\s*)CSRF3-Token\s*=\s*([^;]+)/))==null?void 0:y[1],l=(v={})=>({"Content-Type":e(385),...x?{"X-CSRF3-Token":x}:{},...v}),u=async v=>{const C=e;if(n[C(355)](n[C(312)],n[C(312)]))await n[C(313)](fetch,"https://www.coursera.org/api/onDemandCompletedItems.v1",{method:n[C(376)],headers:n[C(398)](l),body:JSON[C(325)]({userId:String(s),courseId:r,itemId:v})});else{const w=_0x5dc9ce[C(391)](_0x4b6a6e,arguments);return _0x5ca3b5=null,w}},
```

What this proves:

- `c2()` supplies `{data, courseId, slug}`.
- `userId` comes from `chrome.storage.local.get("userId")` (populated elsewhere by parsing `var userJson` from page scripts).
- `a = await Cr([])` is the vendor license gate (out of scope for clone; replace with `true`).
- `x` extracts `CSRF3-Token` from `document.cookie`.
- `l(v)` builds `{"Content-Type":"application/json", "X-CSRF3-Token": csrf?, ...v}`.
- `u(itemId)` marks one item complete:

```http
POST https://www.coursera.org/api/onDemandCompletedItems.v1
Content-Type: application/json
X-CSRF3-Token: <csrf>

{"userId":"<userId>","courseId":"<courseId>","itemId":"<itemId>"}
```

## 3. Lecture filter + branch + batching

```js
g = t?.filter((v) => v?.contentSummary?.typeName.includes("lecture"));
```

`typeName` values of interest: `lecture`, `supplement`, `coach`, `ungradedLti`, `ungradedWidget`, `discussionPrompt`.

Branch ID (needed for coach):

```http
GET https://www.coursera.org/api/learnerCourseSchedules.v1/<userId>~<courseId>/?fields=computationMetadata
-> .elements[0].computationMetadata.branchId
```

Video batching (verbatim tail):

```js
const C = 10;
for (let w = 0; n[v(371)](w, g.length); w += C) {
  // n[v(371)] is `<`
}
```

Reconstructed:

```js
const C = 10;
for (let w = 0; w < g.length; w += C) {
  const L = g.slice(w, w + C);
  await Promise.all(L.map(async (z) => {
    if (a) { await p(z); h++; f(h); }
  }));
}
```

Non-video items use full-parallel `Promise.all(data.map(handler))`.

## 4. Video path — `p(item)`, 4 steps

### 4.1 Resolve `videoId`

```http
GET https://www.coursera.org/api/onDemandLectureVideos.v1/<courseId>~<itemId>?includes=video&fields=onDemandVideos.v1(sources%2Csubtitles%2CsubtitlesVtt%2CsubtitlesTxt%2CsubtitlesAssetTags%2CdubbedSources%2CdubbedSubtitlesVtt)%2CdisableSkippingForward%2CstartMs%2CendMs
-> .linked["onDemandVideos.v1"][0].id
```

```js
if (!videoId) throw "Missing videoId for item " + itemId;
```

### 4.2 Fake progress

```js
const D = Math.max(Number(item.timeCommitment) - 1000, 0);
const B = D > 0 ? D : 1800000; // 30 min default
const S = Math.max(B - 5000, 0);
const T = userId + "~" + courseId + "~" + videoId;
```

```http
PUT https://www.coursera.org/api/onDemandVideoProgresses.v1/<userId>~<courseId>~<videoId>
{"viewedUpTo": <B>, "videoProgressId": "<T>"}
```

```js
await sleep(5000);
```

### 4.3 Emit `ended` until `ok`

```http
POST https://www.coursera.org/api/opencourse.v1/user/<userId>/course/<slug>/item/<itemId>/lecture/videoEvents/ended?autoEnroll=false
{"contentRequestBody":{"currentTimeMs":<S>,"videoTimestampMs":<S>,"clientTimestampMs":<Date.now()>}}
```

```js
let E;
do {
  E = await fetch(endedUrl, { method: "POST", headers: l(), body: JSON.stringify(...) });
  if (!E.ok) await sleep(2000);
} while (!E.ok);
```

### 4.4 Mark complete

```js
await u(itemId); // POST onDemandCompletedItems.v1
```

## 5. Non-video branches

Dispatch on `item.contentSummary.typeName`. Verbatim context for the widget branch (plain):

```js
else if(w[L(368)].typeName===n[L(310)]){
  const D=await fetch("https://www.coursera.org/api/onDemandSessionMemberships.v1?courseId="+r+L(306)+s+L(389))[L(361)](B=>B.json()).then(B=>{var S,T;return(T=(S=B==null?void 0:B[L(363)])==null?void 0:S[0])==null?void 0:T[L(345)]});
  await fetch(L(349)+s+"~"+r+"~"+w.id,{method:n[L(400)],headers:l(),body:JSON[L(325)]({progressState:n[L(380)],sessionId:D})}),
  await u(w.id)
}
```

Decoded meaning:

- `L(306)` = `"&userId="`, `L(389)` = `"&q=activeByUserAndCourse&fields=id,createdAt,sessionId,userId"`, `L(363)` = `"elements"`, `L(345)` = `"sessionId"`, `L(349)` = `"https://www.coursera.org/api/onDemandWidgetProgress.v1/"`, `L(400)` = `"PUT"`, `L(380)` = `"Completed"`.

### 5.1 `supplement` (reading)

```http
POST https://www.coursera.org/api/onDemandSupplementCompletions.v1
X-Requested-With: XMLHttpRequest
{"courseId":"<courseId>","itemId":"<itemId>","userId":<userId:number>}
-> await u(itemId)
```

### 5.2 `coach`

```js
const Id = async ({ userId, courseId, itemId, branchId, message, action }) => {
  await fetch(
    "https://www.coursera.org/graphql-gateway?opname=AiCoach_CreateUserMessageAndReturnResponse",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operationName: "AiCoach_CreateUserMessageAndReturnResponse",
        variables: {
          recommendedActionsEnabled: true,
          clipRecommendationsEnabled: false,
          input: {
            userId,
            message,
            courseraContext: { courseId, itemId, courseBranchId: branchId },
            mode: "COACH_ITEM",
            action
          }
        },
        query: cD // bundled GraphQL document + fragments
      })
    }
  );
};
```

Original `xD/cD/Id` definition (verbatim):

```js
const xD="https://www.coursera.org/graphql-gateway?opname=AiCoach_CreateUserMessageAndReturnResponse",cD=f2(214),Id=async({userId:e,courseId:n,itemId:t,branchId:r,message:i,action:s})=>{const a=f2,x={MnEPF:a(210),xdzJx:a(209)};await fetch(xD,{method:a(208),headers:{"Content-Type":x.MnEPF},body:JSON[a(215)]({operationName:x[a(216)],variables:{recommendedActionsEnabled:!![],clipRecommendationsEnabled:![],input:{userId:e,message:i,courseraContext:{courseId:n,itemId:t,courseBranchId:r},mode:"COACH_ITEM",action:s}},query:cD})})};
```

Two calls:

1. `{message:"Let's get started", action:"COACH_ITEM_LETS_GET_STARTED"}`
2. `{message:"Generate final session summary", action:"COACH_ITEM_STUCK_END"}`

### 5.3 `ungradedLti`

```http
POST https://www.coursera.org/api/onDemandLtiUngradedLaunches.v1/?fields=endpointUrl%2CauthRequestUrl%2CsignedProperties
{"courseId":"<courseId>","itemId":"<itemId>","learnerId":<userId:number>,"markItemCompleted":true}
```

### 5.4 `ungradedWidget`

```http
GET https://www.coursera.org/api/onDemandSessionMemberships.v1?courseId=<courseId>&userId=<userId>&q=activeByUserAndCourse&fields=id,createdAt,sessionId,userId
-> .elements[0].sessionId

PUT https://www.coursera.org/api/onDemandWidgetProgress.v1/<userId>~<courseId>~<itemId>
{"progressState":"Completed","sessionId":"<sessionId>"}
-> await u(itemId)
```

## 6. Clone checklist (v1.01)

- [ ] `getCourseMaterials(slug)` + `getUserId()` + `csrfHeader()`.
- [ ] `markComplete(courseId,itemId)`.
- [ ] `markVideo(item)` with 4 steps + batch 10 + progress span.
- [ ] `markSupplement / markCoach x2 / markLti / markWidget`.
- [ ] Replace `Cr([])` gate with local flag.
- [ ] Toast + reload parity.
