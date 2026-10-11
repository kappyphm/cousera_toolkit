// 1:1 clone of prototype `vD as handleDiscussionPrompt`.
// Origin: prototype/assets/chunk-674d105d.js (~744469), analysis/v1/02-skip-discussing.md
// Same guards, cooldown, GET prompt -> POST co-content answer, pacing, reload.
// No vendor gate, no silent catch — every failure throws CloneError.
import {
  csrfHeaders,
  getCourseMaterials,
  getUserId,
  sleep
} from "../shared/coursera.ts";
import { CloneError, createLogger } from "../shared/logger.ts";

const log = createLogger("skip-discussing");

export const DEFAULT_DISCUSSION_CONTENT = "Very interesting course";
export const COOLDOWN_KEY = "discussionLimitExpiredTime";

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CloneError(`DiscussionPrompts fetch failed status=${res.status}`, {
      module: "skip-discussing", step: "getPrompt",
      courseId, itemId, status: res.status, body: text.slice(0, 500)
    });
  }
  const body = (await res.json()) as PromptQuestion;
  const def = body?.elements?.[0]?.promptType?.definition?.courseItemForumQuestionId;
  const L = def?.split("~")[2];
  if (!L) {
    throw new CloneError("missing courseItemForumQuestionId suffix", {
      module: "skip-discussing", step: "getPrompt", courseId, itemId
    });
  }
  return L;
}

/** 1:1 POST — co-content answer envelope. */
async function postAnswer(
  courseId: string, questionSuffix: string, text: string, itemId: string
): Promise<void> {
  const url =
    "https://www.coursera.org/api/onDemandCourseForumAnswers.v1/" +
    "?fields=content%2CforumQuestionId%2CcourseItemForumQuestionId&includes=profiles%2Cchildren%2CuserId";
  log.info("postAnswer", `POST item=${itemId} q=${questionSuffix}`, {
    courseId, itemId
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { ...csrfHeaders(), "x-csrf3-token": csrfHeaders()["X-CSRF3-Token"] ?? "" },
    body: JSON.stringify({
      content: {
        typeName: "cml",
        definition: {
          dtdId: "discussion/1",
          value: `<co-content><text>${escXml(text)}</text></co-content>`
        }
      },
      courseForumQuestionId: `${courseId}~${questionSuffix}`
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new CloneError(`CourseForumAnswers POST failed status=${res.status}`, {
      module: "skip-discussing", step: "postAnswer",
      courseId, itemId, status: res.status, body: body.slice(0, 500)
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
  if (!window.location.href.includes("/learn/")) {
    throw new CloneError("not a course page (missing /learn/)", {
      module: "skip-discussing", step: "guard"
    });
  }
  const { data, courseId } = await getCourseMaterials();
  const userId = await getUserId();

  const cached = await chrome.storage.sync.get(COOLDOWN_KEY);
  const until = Number(cached?.[COOLDOWN_KEY] ?? 0);
  if (Date.now() < until) {
    throw new CloneError(
      `on cooldown until ${new Date(until).toLocaleTimeString()}`, {
        module: "skip-discussing", step: "cooldown", courseId
      });
  }

  const targets = data.filter((c) =>
    c?.contentSummary?.typeName?.includes("discussionPrompt"));
  log.info("resolve", `targets=${targets.length}/${data.length}`, { courseId });
  if (targets.length === 0) {
    log.info("resolve", "nothing to discuss");
    return;
  }

  await chrome.storage.sync.set({
    [COOLDOWN_KEY]: Date.now() + 1000 * waitingTimeSec * (targets.length + 1)
  });

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
