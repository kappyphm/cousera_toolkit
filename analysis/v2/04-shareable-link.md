# v2.04 — Shareable Link (`yy` component + popup guard)

Source: `assets/chunk-674d105d.js` `yy` (~180811), `fg as getMetadata`, background tab-close guard, `script.js` popup blocker.

## 1. Flow overview

```
DOM script tag -> branchId -> fg() {course_id,item_id,open_course_slug}
  -> GET PeerAssignmentPermissions -> latestSubmissionSummary.id
  -> build /learn/<slug>/peer/.../course-project/review/<submissionId>
  -> render readonly input + copy button (clipboard.writeText)
```

## 2. Branch + course resolution

```js
const h = document.querySelector("body > script:nth-child(3)")?.innerText;
await Cr(); // vendor gate; clone replaces with true
const m = h.match(/(\d+~[A-Za-z0-9-_]+)/);
const y = m?.[1].split("~")[0]; // branchId
const v = fg();
// v.course_id, v.item_id, v.open_course_slug
```

Same regex as `d2` (v2.02): `/(\d+~[A-Za-z0-9-_]+)/`.

## 3. Submission lookup — REST

```http
GET https://www.coursera.org/api/onDemandPeerAssignmentPermissions.v1/<branchId>~<courseId>~<itemId>/?fields=deleteSubmission%2ClistSubmissions%2CreviewPeers%2CviewReviewSchema%2CanonymousPeerReview%2ConDemandPeerSubmissionProgresses.v1(latestSubmissionSummary%2ClatestDraftSummary%2ClatestAttemptSummary)%2ConDemandPeerReceivedReviewProgresses.v1(...)%2ConDemandPeerDisplayablePhaseSchedules.v1(...)&includes=receivedReviewsProgress%2CsubmissionProgress%2CphaseSchedule
-> .linked.onDemandPeerSubmissionProgresses.v1[0].latestSubmissionSummary.id
```

```js
const C = await fetch(
  "https://www.coursera.org/api/onDemandPeerAssignmentPermissions.v1/" +
    y + "~" + v.course_id + "~" + v.item_id + "/?fields=..."
).then((L) => L.json())
 .then((L) => L.linked.onDemandPeerSubmissionProgresses.v1[0].latestSubmissionSummary.id)
 .catch(() => "");

if (!C) {
  toast("You haven't done your assignment yet");
  return "";
}
```

## 4. URL build + copy UI

```js
const w =
  "https://www.coursera.org/learn/" + v.open_course_slug +
  "/peer/" + v.item_id + "..." +
  "/course-project/review/" + C;
```

Rendered UI pattern:

```jsx
<input id="website-url" readOnly disabled value={t} />
<button onClick={copy}>Copy</button>
<button onClick={u}>Get URL</button>

const copy = async () => {
  await Cr();
  await navigator.clipboard.writeText(t);
  setTimeout(() => setCopied(false), 1000);
};
```

`copy` uses `navigator.clipboard.writeText` (verbatim `writeText` hit in bundle).

## 5. Popup suppression (required for clean UX)

Page-world `script.js` (verbatim full file):

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
    if (shouldBlock(url)) {
      return null;
    }

    if (shouldIntercept(url)) {
      intercept(url);
      return { closed: false, focus: () => {}, close: () => {} };
    }

    return originalOpen.apply(this, [url, ...args]);
  };
})();
```

Background closes stray tabs whose URL contains `submission-start` / `submission-complete` via `chrome.tabs.onUpdated -> chrome.tabs.remove(tabId)` (full router in `v3/02-bypass-locked-browser.md`).

Content requests opening the shareable URL in foreground/background:

```js
chrome.runtime.sendMessage({ action: "openTab", url: w });
chrome.runtime.sendMessage({ action: "openInBackground", url: w });
```

## 6. Clone checklist (v2.04)

- [ ] `getShareableLink()`: script-tag regex + `fg()` + permissions fetch + URL build.
- [ ] Empty-`submissionId` toast path.
- [ ] Clipboard copy + Get-URL UI.
- [ ] Reuse `window.open` blocker + background tab guard so "Get link" never spawns junk popups.
