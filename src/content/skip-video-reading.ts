// 1:1 clone of prototype `dD as resolveWeekMaterial`.
// Origin: prototype/assets/chunk-674d105d.js (~727970+), analysis/v1/01-skip-video-reading.md
// Fidelity rules: same endpoints, same order, same bodies. No license gate
// (prototype `Cr([])` replaced by explicit log). No silent catch — every
// failure throws CloneError with courseId/itemId/status.
import {
  csrfHeaders,
  getCourseMaterials,
  getUserId,
  postJson,
  sleep,
  type MaterialItem
} from "../shared/coursera.ts";
import { CloneError, createLogger } from "../shared/logger.ts";

const log = createLogger("skip-video-reading");

const VIDEO_FIELDS =
  "onDemandVideos.v1(sources%2Csubtitles%2CsubtitlesVtt%2CsubtitlesTxt%2CsubtitlesAssetTags%2CdubbedSources%2CdubbedSubtitlesVtt)%2CdisableSkippingForward%2CstartMs%2CendMs";

export interface SkipProgress {
  done: number;
  total: number;
}

function reportProgress(done: number, total: number): void {
  const el = document.getElementById("progress");
  if (el) el.innerHTML = String(done);
  log.info("progress", `Progress: ${done}/${total}`, { done, total });
}

/** 1:1 of prototype `u(itemId)` — POST onDemandCompletedItems.v1 */
async function markComplete(
  courseId: string,
  userId: string,
  itemId: string
): Promise<void> {
  await postJson("skip-video-reading", "markComplete",
    "https://www.coursera.org/api/onDemandCompletedItems.v1",
    { userId: String(userId), courseId, itemId },
    csrfHeaders(),
    { courseId, itemId, userId });
}

/** 1:1 of prototype `p(item)` — 4-step video path. */
async function markVideo(
  courseId: string,
  slug: string,
  userId: string,
  item: MaterialItem
): Promise<void> {
  const itemId = item.id;
  log.info("markVideo", `start item=${itemId}`, { courseId, itemId, slug });

  // B1: resolve videoId — GET LectureVideos
  const vUrl =
    `https://www.coursera.org/api/onDemandLectureVideos.v1/${courseId}~${itemId}` +
    `?includes=video&fields=${VIDEO_FIELDS}`;
  log.info("markVideo.resolve", `GET ${vUrl}`, { courseId, itemId });
  const vRes = await fetch(vUrl, { method: "GET" });
  if (!vRes.ok) {
    const text = await vRes.text().catch(() => "");
    throw new CloneError(`LectureVideos fetch failed status=${vRes.status}`, {
      module: "skip-video-reading", step: "markVideo.resolve",
      courseId, itemId, status: vRes.status, body: text.slice(0, 500)
    });
  }
  const vBody = (await vRes.json()) as {
    linked?: Record<string, Array<{ id: string }>>;
  };
  const videoId = vBody?.linked?.["onDemandVideos.v1"]?.[0]?.id;
  if (!videoId) {
    throw new CloneError(`Missing videoId for item ${itemId}`, {
      module: "skip-video-reading", step: "markVideo.resolve", courseId, itemId
    });
  }
  log.info("markVideo.resolve", `videoId=${videoId}`, { courseId, itemId });

  // B2: fake progress — PUT VideoProgresses
  const commitment = Number(item.timeCommitment);
  const D = Number.isFinite(commitment) ? Math.max(commitment - 1000, 0) : 0;
  const B = D > 0 ? D : 1800000;
  const S = Math.max(B - 5000, 0);
  const T = `${userId}~${courseId}~${videoId}`;
  const pUrl = `https://www.coursera.org/api/onDemandVideoProgresses.v1/${T}`;
  log.info("markVideo.progress", `PUT viewedUpTo=${B}`, { courseId, itemId });
  const pRes = await fetch(pUrl, {
    method: "PUT",
    headers: csrfHeaders(),
    body: JSON.stringify({ viewedUpTo: B, videoProgressId: T })
  });
  if (!pRes.ok) {
    const text = await pRes.text().catch(() => "");
    throw new CloneError(`VideoProgresses PUT failed status=${pRes.status}`, {
      module: "skip-video-reading", step: "markVideo.progress",
      courseId, itemId, status: pRes.status, body: text.slice(0, 500)
    });
  }
  await sleep(5000);

  // B3: ended event loop until ok — POST videoEvents/ended
  const eUrl =
    `https://www.coursera.org/api/opencourse.v1/user/${userId}/course/${slug}` +
    `/item/${itemId}/lecture/videoEvents/ended?autoEnroll=false`;
  log.info("markVideo.ended", `POST loop ${eUrl}`, { courseId, itemId, slug });
  for (;;) {
    const eRes = await fetch(eUrl, {
      method: "POST",
      headers: csrfHeaders(),
      body: JSON.stringify({
        contentRequestBody: {
          currentTimeMs: S,
          videoTimestampMs: S,
          clientTimestampMs: Date.now()
        }
      })
    });
    if (eRes.ok) {
      log.info("markVideo.ended", "ok", { courseId, itemId });
      break;
    }
    const text = await eRes.text().catch(() => "");
    log.warn("markVideo.ended", `retry status=${eRes.status}`, {
      courseId, itemId, status: eRes.status, body: text.slice(0, 300)
    });
    await sleep(2000);
  }

  // B4: mark complete
  await markComplete(courseId, userId, itemId);
  log.info("markVideo", `done item=${itemId}`, { courseId, itemId });
}

async function markSupplement(
  courseId: string, userId: string, item: MaterialItem
): Promise<void> {
  await postJson("skip-video-reading", "markSupplement",
    "https://www.coursera.org/api/onDemandSupplementCompletions.v1",
    { courseId, itemId: item.id, userId: Number(userId) },
    csrfHeaders({ "X-Requested-With": "XMLHttpRequest" }),
    { courseId, itemId: item.id });
  await markComplete(courseId, userId, item.id);
}

async function getBranchId(courseId: string, userId: string): Promise<string> {
  const url =
    `https://www.coursera.org/api/learnerCourseSchedules.v1/${userId}~${courseId}/?fields=computationMetadata`;
  log.info("getBranchId", `GET ${url}`, { courseId, userId });
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CloneError(`learnerCourseSchedules failed status=${res.status}`, {
      module: "skip-video-reading", step: "getBranchId",
      courseId, status: res.status, body: text.slice(0, 500)
    });
  }
  const body = (await res.json()) as {
    elements?: Array<{ computationMetadata?: { branchId?: string } }>;
  };
  const branchId = body?.elements?.[0]?.computationMetadata?.branchId;
  if (!branchId) {
    throw new CloneError("missing branchId in schedules response", {
      module: "skip-video-reading", step: "getBranchId", courseId
    });
  }
  return branchId;
}

async function postCoach(
  userId: string, courseId: string, itemId: string, branchId: string,
  message: string, action: string, query: string
): Promise<void> {
  await postJson("skip-video-reading", "markCoach",
    "https://www.coursera.org/graphql-gateway?opname=AiCoach_CreateUserMessageAndReturnResponse",
    {
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
      query
    },
    { "Content-Type": "application/json" },
    { courseId, itemId, action });
}

/** 1:1 coach branch — caller must supply the bundled GraphQL document `cD`. */
export async function markCoach(
  userId: string, courseId: string, item: MaterialItem,
  branchId: string, graphqlDoc: string
): Promise<void> {
  await postCoach(userId, courseId, item.id, branchId,
    "Let's get started", "COACH_ITEM_LETS_GET_STARTED", graphqlDoc);
  await postCoach(userId, courseId, item.id, branchId,
    "Generate final session summary", "COACH_ITEM_STUCK_END", graphqlDoc);
  log.info("markCoach", `done item=${item.id}`, { courseId, itemId: item.id });
}

async function markLti(
  courseId: string, userId: string, item: MaterialItem
): Promise<void> {
  await postJson("skip-video-reading", "markLti",
    "https://www.coursera.org/api/onDemandLtiUngradedLaunches.v1/?fields=endpointUrl%2CauthRequestUrl%2CsignedProperties",
    { courseId, itemId: item.id, learnerId: Number(userId), markItemCompleted: true },
    csrfHeaders(),
    { courseId, itemId: item.id });
}

async function markWidget(
  courseId: string, userId: string, item: MaterialItem
): Promise<void> {
  const listUrl =
    `https://www.coursera.org/api/onDemandSessionMemberships.v1?courseId=${courseId}` +
    `&userId=${userId}&q=activeByUserAndCourse&fields=id,createdAt,sessionId,userId`;
  log.info("markWidget.session", `GET ${listUrl}`, { courseId, itemId: item.id });
  const res = await fetch(listUrl);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CloneError(`SessionMemberships failed status=${res.status}`, {
      module: "skip-video-reading", step: "markWidget.session",
      courseId, itemId: item.id, status: res.status, body: text.slice(0, 500)
    });
  }
  const body = (await res.json()) as {
    elements?: Array<{ sessionId?: string }>;
  };
  const sessionId = body?.elements?.[0]?.sessionId;
  if (!sessionId) {
    throw new CloneError("missing sessionId in memberships response", {
      module: "skip-video-reading", step: "markWidget.session",
      courseId, itemId: item.id
    });
  }
  const putUrl =
    `https://www.coursera.org/api/onDemandWidgetProgress.v1/${userId}~${courseId}~${item.id}`;
  log.info("markWidget.progress", `PUT ${putUrl}`, { courseId, itemId: item.id });
  const put = await fetch(putUrl, {
    method: "PUT",
    headers: csrfHeaders(),
    body: JSON.stringify({ progressState: "Completed", sessionId })
  });
  if (!put.ok) {
    const text = await put.text().catch(() => "");
    throw new CloneError(`WidgetProgress PUT failed status=${put.status}`, {
      module: "skip-video-reading", step: "markWidget.progress",
      courseId, itemId: item.id, status: put.status, body: text.slice(0, 500)
    });
  }
  await markComplete(courseId, userId, item.id);
}

/**
 * 1:1 of `dD` minus vendor gate. `coachGraphqlDoc` is required only when the
 * course contains `coach` items; otherwise pass "" and coach items throw
 * explicitly instead of being silently skipped.
 */
export async function resolveWeekMaterial(
  onProgress?: (p: SkipProgress) => void,
  coachGraphqlDoc = ""
): Promise<void> {
  log.info("resolve", "Skipping Videos & Readings — start");
  const started = performance.now();
  const { data, courseId, slug } = await getCourseMaterials();
  const userId = await getUserId();

  const lectures = data.filter((v) =>
    v?.contentSummary?.typeName?.includes("lecture"));
  log.info("resolve", `lectures=${lectures.length}/${data.length}`, {
    courseId, slug
  });

  let branchId = "";
  const needsBranch = data.some(
    (v) => v?.contentSummary?.typeName === "coach");
  if (needsBranch) branchId = await getBranchId(courseId, userId);

  // Non-video branches — full parallel like prototype, fail-fast with logs.
  const runBranch = async (w: MaterialItem): Promise<void> => {
    const type = w?.contentSummary?.typeName;
    try {
      if (type === "supplement") await markSupplement(courseId, userId, w);
      else if (type === "coach") {
        if (!coachGraphqlDoc) {
          throw new CloneError("coach item needs bundled GraphQL doc (cD)", {
            module: "skip-video-reading", step: "runBranch",
            courseId, itemId: w.id
          });
        }
        await markCoach(userId, courseId, w, branchId, coachGraphqlDoc);
      } else if (type === "ungradedLti") await markLti(courseId, userId, w);
      else if (type === "ungradedWidget") await markWidget(courseId, userId, w);
      else if (type?.includes("lecture")) return; // handled below
      else log.debug("runBranch", `skip type=${String(type)}`, { itemId: w.id });
    } catch (e) {
      log.error("runBranch", `item=${w.id} type=${String(type)} failed`, {
        courseId, itemId: w.id, error: (e as Error).message
      });
      throw e;
    }
  };
  await Promise.all(data.map(runBranch));

  // Video path — batches of 10 like prototype.
  let h = 0;
  const C = 10;
  for (let w = 0; w < lectures.length; w += C) {
    const slice = lectures.slice(w, w + C);
    await Promise.all(slice.map(async (z) => {
      try {
        await markVideo(courseId, slug, userId, z);
      } catch (e) {
        log.error("resolve.video", `item=${z.id} failed`, { courseId, itemId: z.id });
        throw e;
      }
      h++;
      reportProgress(h, lectures.length);
      onProgress?.({ done: h, total: lectures.length });
    }));
  }

  log.info("resolve", "Skip Videos & Readings Completed!", {
    courseId, slug, ms: Math.round(performance.now() - started)
  });
}
