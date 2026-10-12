# v2.04 — Shareable Link (`yy` component + background tab guard)

Source: `prototype/assets/chunk-674d105d.js` `yy` @ ~167960 (shareable), background `chunk-67a65bb5.js`.
Decoder: `Re` (table `Bs`, base 492, rotation (Bs, 318655)).

## 1. Flow overview

```
DOM script tag -> branchId -> fg() {course_id, item_id, open_course_slug}
  -> GET PeerAssignmentPermissions -> latestSubmissionSummary.id
  -> build /learn/<slug>/peer/.../course-project/review/<submissionId>
  -> render readonly input + copy button (clipboard.writeText)
```

## 2. Branch + course resolution

```js
const h=document.querySelector("body > script:nth-child(3)")?.innerText;
await Cr(); // vendor gate; clone replaces with true
const m=h.match(/(\d+~[A-Za-z0-9-_]+)/);
const y=m?.[1].split("~")[0]; // branchId
const v=fg();
// v.course_id, v.item_id, v.open_course_slug
```

Same regex as `d2` (v2.02): `/(\d+~[A-Za-z0-9-_]+)/`.

## 3. Submission lookup — REST

```js
const C=await fetch(
  "https://www.coursera.org/api/onDemandPeerAssignmentPermissions.v1/"+y+"~"+v.course_id+"~"+v.item_id+"/?fields=deleteSubmission%2ClistSubmissions%2CreviewPeers%2CviewReviewSchema%2CanonymousPeerReview%2ConDemandPeerSubmissionProgresses.v1(latestSubmissionSummary%2ClatestDraftSummary%2ClatestAttemptSummary)%2ConDemandPeerReceivedReviewProgresses.v1(evaluationIfReady%2CearliestCompletionTime%2CreviewCount%2CdefaultReceivedReviewRequiredCount)%2ConDemandPeerDisplayablePhaseSchedules.v1(currentPhase%2CphaseEnds%2CphaseStarts)&includes=receivedReviewsProgress%2CsubmissionProgress%2CphaseSchedule"
)[L(151)](L=>L.json())[L(151)](L=>L.linked.onDemandPeerSubmissionProgresses.v1[0].latestSubmissionSummary.id).catch(()=>"");

if(!C){
  toast("You haven't done your assignment yet");
  return "";
}
```

Decoded from `Re` table:
- `Re(566)` = `https://www.coursera.org/api/onDemandPeerAssignmentPermissions.v1/`
- `Re(495)` = `/course-project/review/`

## 4. URL build + copy UI

```js
const w="https://www.coursera.org/learn/"+v.open_course_slug+"/peer/"+v.item_id+".../course-project/review/"+C;
```

Full URL pattern (reconstructed from `Re(495)` + `yy` context):
```
https://www.coursera.org/learn/<open_course_slug>/peer/<item_id>/.../course-project/review/<submissionId>
```

### Copy button handler (verbatim from bundle)

```js
const copy=async()=>{
  await Cr();
  await navigator.clipboard.writeText(t);
  setTimeout(()=>setCopied(false),1000);
};
```

- `navigator.clipboard.writeText` — verified plain hit @ 366241
- 1s feedback timeout

### UI pattern

```jsx
<input id="website-url" readOnly disabled value={t} />
<button onClick={copy}>Copy</button>
<button onClick={u}>Get URL</button>
```

## 5. Popup suppression (required for clean UX)

### 5.1 Page-world `script.js` (verbatim full file)

```js
(function () {
  const userAgent = 'coursera-locking-browser/0.6.3';
  try {
    Object.defineProperty(navigator, 'userAgent', {
      get: () => userAgent,
      configurable: false,
    });
  } catch (_e) {}
  window.coursera = window.coursera || {};
  const shouldIntercept = (url) => typeof url === 'string' && url.startsWith('coursera-lock://');
  const shouldBlock = (url) =>
    typeof url === 'string' &&
    (url.includes('submission-start') || url.includes('submission-complete'));
  const intercept = (url) => {
    window.dispatchEvent(new CustomEvent('BypassCoursera_Intercept', { detail: url }));
  };
  const originalOpen = window.open;
  window.open = function (url, ...args) {
    if (shouldBlock(url)) return null;
    if (shouldIntercept(url)) {
      intercept(url);
      return { closed: false, focus: () => {}, close: () => {} };
    }
    return originalOpen.apply(this, [url, ...args]);
  };
})();
```

Key behaviors:
- Spoofs UA to `coursera-locking-browser/0.6.3`
- Blocks `window.open` for URLs containing `submission-start` or `submission-complete`
- Intercepts `coursera-lock://` URLs → dispatches `BypassCoursera_Intercept` event

### 5.2 Background tab guard (decoded from `chunk-67a65bb5.js`)

Decoder `i` (table `w`, base 377, rotation (w, 379895)):

- `i(405)` = `"openTab"` — message action for foreground tab
- `i(412)` = `"openInBackground"` — message action for background tab
- `i(434)` = `"submission-start/"` — tab URL pattern to close
- `i(458)` = `"submission-complete/"` — tab URL pattern to close
- `i(410)` = `"remove"` — `chrome.tabs.remove`
- `i(484)` = `"tabs"` — `chrome.tabs` API
- `i(496)` = `"sendMessage"` — `chrome.runtime.sendMessage`

Background listener (reconstructed):
```js
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url?.includes("submission-start/") || tab.url?.includes("submission-complete/")) {
    chrome.tabs.remove(tabId).catch(err => console.log("Tab close error:", err));
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "openTab") {
    chrome.tabs.create({ url: msg.url, active: true });
  }
  if (msg.action === "openInBackground") {
    chrome.tabs.create({ url: msg.url, active: false });
  }
});
```

### 5.3 Content requests opening shareable URL

```js
chrome.runtime.sendMessage({ action: "openTab", url: w });
chrome.runtime.sendMessage({ action: "openInBackground", url: w });
```

## 6. Clone checklist (v2.04)

- [ ] `getShareableLink()`: script-tag regex + `fg()` + permissions fetch + URL build.
- [ ] Empty-`submissionId` toast path ("You haven't done your assignment yet").
- [ ] Clipboard copy via `navigator.clipboard.writeText` + 1s feedback.
- [ ] Reuse `window.open` blocker (`script.js`) + background tab guard so "Get link" never spawns junk popups.
- [ ] Background: `openTab` / `openInBackground` message handlers + `submission-start/`/`submission-complete/` tab closer.
