# v1.02 — Skip Discussing (`vD as handleDiscussionPrompt`)

Source: `assets/chunk-674d105d.js` (~744469), exported as `vD as handleDiscussionPrompt`.

Popup callsite pattern:

```js
await vD(discussionWaitingTime, defaultDiscussionContent);
// defaults: discussionWaitingTime = 20 (seconds), content falls back to metadata default
```

## 1. Guards + inputs

```js
if (!location.href.includes("/learn/")) {
  alert("This is not a course page...");
  return;
}

const { data, courseId } = await c2(); // same discovery as skip-video
const { userId } = await chrome.storage.local.get("userId");
const { discussionLimitExpiredTime } = await chrome.storage.sync.get("discussionLimitExpiredTime");
const csrf = document.cookie.match(/(?:^|;\s*)CSRF3-Token\s*=\s*([^;]+)/)?.[1] || "";

const gate = await Cr([]); // vendor gate; clone replaces with true
if (!gate) return;

const targets = data?.filter((c) =>
  c?.contentSummary?.typeName.includes("discussionPrompt")
);
```

Cooldown (prevents Coursera rate-limit ban):

```js
if (Date.now() < discussionLimitExpiredTime) {
  alert(
    "Discussion prompt handling is on cooldown until " +
      new Date(discussionLimitExpiredTime).toLocaleTimeString() +
      ". Please try again later."
  );
  return;
}

await chrome.storage.sync.set({
  discussionLimitExpiredTime: Date.now() + 1000 * waitingTime * (targets.length + 1)
});
```

Progress toast when `targets.length > 0` (same style as v1.01: `1px solid #0356fc`, `top-right`, `span#progress`):

```html
Handling discussions slowly to prevent banned by
<a target="_blank" class="text-blue-600"
   href="https://www.coursera.support/...blocked...">Coursera's rate limit policy</a>.
Progress: <span id="progress">0</span>/N
```

## 2. Resolve prompt question — GET

```http
GET https://www.coursera.org/api/onDemandDiscussionPrompts.v1/<userId>~<courseId>~<itemId>?fields=onDemandDiscussionPromptQuestions.v1(content,creatorId,createdAt,forumId,sessionId,lastAnsweredBy,lastAnsweredAt,totalAnswerCount,topLevelAnswerCount,viewCount),promptType,question&includes=question
Method: GET
```

```js
const w = await fetch(promptUrl).then((z) => z.json());
const m = w.elements[0];
const v = m.promptType.definition;
const L = v.courseItemForumQuestionId.split("~")[2];
```

`L` is the forum question suffix used below.

## 3. Post answer — POST `co-content`

```http
POST https://www.coursera.org/api/onDemandCourseForumAnswers.v1/?fields=content%2CforumQuestionId%2C...%2CcourseItemForumQuestionId%2C...&includes=profiles%2Cchildren%2CuserId
Method: POST
x-csrf3-token: <csrf>

{
  "content": {
    "typeName": "cml",
    "definition": {
      "dtdId": "discussion/1",
      "value": "<co-content><text><TEXT></text></co-content>"
    }
  },
  "courseForumQuestionId": "<courseId>~<L>"
}
```

Per-item toast (note original typo preserved):

```js
await toast.promise(fetch(...), {
  loading: "Doing disccussion: " + item.name,
  success: "Done " + item.name + "!",
  error: "Discuss failed!"
});
```

Pacing + progress:

```js
p++;
document.getElementById("progress").innerHTML = p + "";
if (targets.length >= 3) await sleep(1000 * waitingTime);
```

Finish:

```js
await sleep(2000);
location.reload();
```

## 4. Content fallback

Popup resolves text as `userText ?? metadata.defaultDiscussionContent`. Live `metadata.json` currently returns:

```json
{ "defaultDiscussionContent": "Very interesting course" }
```

Clone: `handleDiscussionPrompt(waitSec, text = "Very interesting course")`.

## 5. Clone checklist (v1.02)

- [ ] Reuse `c2()`, `csrf`, `toast progress`.
- [ ] Implement cooldown key `discussionLimitExpiredTime` in `chrome.storage.sync`.
- [ ] `GET DiscussionPrompts -> L`, `POST CourseForumAnswers` with `co-content` envelope.
- [ ] Pace `waitingTime` seconds, `>=3` items path.
- [ ] Remove `Cr([])` gate.
