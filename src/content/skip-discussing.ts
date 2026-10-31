// 1:1 clone of prototype `vD as handleDiscussionPrompt`.
// Origin: prototype/assets/chunk-674d105d.js (~744469), analysis/v1/02-skip-discussing.md
// Same guards, cooldown, GET prompt -> POST co-content answer, pacing, reload.
// No vendor gate. Error parity (audit đợt 1): guard/cooldown alert + return
// like the prototype; the POST's HTTP status is logged, not thrown.
import {
  csrfToken,
  getCourseMaterials,
  getUserId,
  showProgressToast,
  sleep
} from "../shared/coursera.ts";
import { CloneError, createLogger } from "../shared/logger.ts";

const log = createLogger("skip-discussing");

export const DEFAULT_DISCUSSION_CONTENT = "Very interesting course";
export const COOLDOWN_KEY = "discussionLimitExpiredTime";

interface PromptQuestion {
  elements?: Array<{
    promptType?: { definition?: { courseItemForumQuestionId?: string } };
  }>;
}

/** 1:1 GET — resolve forum question suffix L. */
async function getForumQuestionSuffix(
  userId: string, courseId: string, itemId: string
): Promise<string> {
  const url =
    `https://www.coursera.org/api/onDemandDiscussionPrompts.v1/${userId}~${courseId}~${itemId}` +
    "?fields=onDemandDiscussionPromptQuestions.v1(content,creatorId,createdAt,forumId,sessionId,lastAnsweredBy,lastAnsweredAt,totalAnswerCount,topLevelAnswerCount,viewCount),promptType,question&includes=question";
  log.info("getPrompt", `GET item=${itemId}`, { courseId, itemId });
  // Prototype: fetch(...).then(z => z.json()) — no ok-check.
  const body = (await (await fetch(url, { method: "GET" })).json()) as PromptQuestion;
  const def = body?.elements?.[0]?.promptType?.definition?.courseItemForumQuestionId;
  const L = def?.split("~")[2];
  if (!L) {
    throw new CloneError("missing courseItemForumQuestionId suffix", {
      module: "skip-discussing", step: "getPrompt", courseId, itemId
    });
  }
  return L;
}

/** 1:1 POST — co-content answer envelope (prototype: headers only x-csrf3-token). */
async function postAnswer(
  courseId: string, questionSuffix: string, text: string, itemId: string
): Promise<void> {
  // Exact URL from prototype ke(149) (decoded table `ke`).
  const url =
    "https://www.coursera.org/api/onDemandCourseForumAnswers.v1/" +
    "?fields=content%2CforumQuestionId%2CparentForumAnswerId%2Cstate%2CcreatorId%2CcreatedAt%2Corder%2CupvoteCount%2CchildAnswerCount%2CisFlagged%2CisUpvoted%2CcourseItemForumQuestionId%2CparentCourseItemForumAnswerId%2ConDemandSocialProfiles.v1(userId%2CexternalUserId%2CfullName%2CphotoUrl%2CcourseRole)%2ConDemandCourseForumAnswers.v1(content%2CforumQuestionId%2CparentForumAnswerId%2Cstate%2CcreatorId%2CcreatedAt%2Corder%2CupvoteCount%2CchildAnswerCount%2CisFlagged%2CisUpvoted%2CcourseItemForumQuestionId%2CparentCourseItemForumAnswerId)&includes=profiles%2Cchildren%2CuserId";
  // Prototype: csrf = match(...)?.[1] || "" — an absent cookie yields an
  // empty header value, not an abort.
  const token = csrfToken() ?? "";
  if (!token) log.warn("postAnswer", "CSRF3-Token cookie missing — sending empty token like prototype", { courseId, itemId });
  log.info("postAnswer", `POST item=${itemId} q=${questionSuffix}`, {
    courseId, itemId
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-csrf3-token": token },
    body: JSON.stringify({
      content: {
        typeName: "cml",
        definition: {
          dtdId: "discussion/1",
          // ke(160)+content+ke(177) — prototype does NOT escape content.
          value: `<co-content><text>${text}</text></co-content>`
        }
      },
      courseForumQuestionId: `${courseId}~${questionSuffix}`
    })
  });
  // Prototype wraps this fetch in toast.promise: fetch resolves on HTTP
  // error statuses, so a non-2xx is NOT a failure there. Log the status
  // and continue (parity — no throw).
  if (!res.ok) {
    log.error("postAnswer", `POST status=${res.status} (prototype: unchecked)`, {
      courseId, itemId, status: res.status
    });
  }
  await res.json().catch(() => ({}));
  log.info("postAnswer", `Done ${itemId}!`, { courseId, itemId });
}

/**
 * 1:1 of `vD(waitingTime, content)`.
 * - waitingTime: seconds between posts when >=3 targets (prototype default 20).
 * - content: falls back to DEFAULT_DISCUSSION_CONTENT (prototype metadata).
 */
export async function handleDiscussionPrompt(
  waitingTimeSec = 20,
  content: string = DEFAULT_DISCUSSION_CONTENT,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  log.info("resolve", "Handling discussions — start", { waitingTimeSec });
  // Prototype guard: alert + return (parity fix — clone previously threw).
  if (!window.location.href.includes("/learn/")) {
    const msg = "This is not a course page, please go to your course page first";
    log.error("resolve", "guard failed — not /learn/", { href: window.location.href });
    alert(msg);
    return;
  }
  const { data, courseId } = await getCourseMaterials();
  const userId = await getUserId();

  const targets = data.filter((c) =>
    c?.contentSummary?.typeName?.includes("discussionPrompt"));
  log.info("resolve", `targets=${targets.length}/${data.length}`, { courseId });

  // Prototype order (analysis/v1/02 §1): cooldown check (alert + return),
  // then the cooldown is SET unconditionally, before the posting loop.
  const cached = await chrome.storage.sync.get(COOLDOWN_KEY);
  const until = Number(cached?.[COOLDOWN_KEY] ?? 0);
  if (Date.now() < until) {
    const msg =
      "Discussion prompt handling is on cooldown until " +
      new Date(until).toLocaleTimeString() +
      ". Please try again later.";
    log.error("resolve", msg, { courseId });
    alert(msg);
    return;
  }
  await chrome.storage.sync.set({
    [COOLDOWN_KEY]: Date.now() + 1000 * waitingTimeSec * (targets.length + 1)
  });

  if (targets.length === 0) {
    log.info("resolve", "nothing to discuss");
    return;
  }

  // F3: prototype caller shows the progress toast when targets exist.
  showProgressToast(
    `<div>Handling discussions slowly to prevent banned by Coursera's ` +
      `rate limit policy.<br>Progress: <span id="progress">0</span>/${targets.length}</div>`
  );

  let p = 0;
  for (const c of targets) {
    log.info("resolve", `Doing discussion: ${c.name ?? c.id}`, {
      courseId, itemId: c.id
    });
    try {
      const L = await getForumQuestionSuffix(userId, courseId, c.id);
      await postAnswer(courseId, L, content, c.id);
    } catch (e) {
      log.error("resolve", `Discuss failed! item=${c.id}`, {
        courseId, itemId: c.id, error: (e as Error).message
      });
      throw e;
    }
    p++;
    const el = document.getElementById("progress");
    if (el) el.innerHTML = String(p);
    onProgress?.(p, targets.length);
    if (targets.length >= 3) await sleep(1000 * waitingTimeSec);
  }

  log.info("resolve", "discussions done, reloading in 2s", { courseId });
  await sleep(2000);
  window.location.reload();
}
