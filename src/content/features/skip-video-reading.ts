// 1:1 clone of prototype `dD as resolveWeekMaterial`.
// Origin: prototype/assets/chunk-674d105d.js (~727970+), analysis/v1/01-skip-video-reading.md
// Fidelity rules: same endpoints, same order, same bodies. No license gate
// (prototype `Cr([])` replaced by explicit log). Error parity (audit đợt 1):
// HTTP error statuses are logged, not thrown — the prototype checks almost
// none of them; CloneError remains only where the prototype also stops
// (e.g. missing videoId throw, waitForSelector timeout).
import { showProgressToast, sleep } from "../../platform/coursera-dom.ts";
import { csrfHeaders, getCourseMaterials, getUserId, postJson, type MaterialItem } from "../../platform/coursera-api.ts";
import { CloneError, createLogger } from "../../platform/logger.ts";

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
    // Prototype does not check this PUT's status — log and continue.
    const text = await pRes.text().catch(() => "");
    log.error("markVideo.progress", `PUT status=${pRes.status} (prototype: unchecked)`, {
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
  // Prototype: fetch -> .json() -> elements[0].computationMetadata.branchId,
  // no ok-check and no throw when the value is absent (it is simply
  // undefined downstream). Parity: log and return "" instead of throwing.
  const body = (await (await fetch(url)).json()) as {
    elements?: Array<{ computationMetadata?: { branchId?: string } }>;
  };
  const branchId = body?.elements?.[0]?.computationMetadata?.branchId;
  if (!branchId) {
    log.error("getBranchId", "missing branchId in schedules response (prototype: undefined, no throw)", {
      courseId
    });
    return "";
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
  // Prototype (verbatim context, analysis/v1/01 §5): fetch -> .json() ->
  // elements[0].sessionId, then PUT, then u(itemId). No ok-checks and no
  // throw when sessionId is absent (undefined flows into the PUT body).
  const body = (await (await fetch(listUrl)).json()) as {
    elements?: Array<{ sessionId?: string }>;
  };
  const sessionId = body?.elements?.[0]?.sessionId;
  if (!sessionId) {
    log.error("markWidget.session", "missing sessionId (prototype: undefined, flow continues)", {
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
    log.error("markWidget.progress", `PUT status=${put.status} (prototype: unchecked)`, {
      courseId, itemId: item.id, status: put.status, body: text.slice(0, 500)
    });
  }
  await markComplete(courseId, userId, item.id);
}

/**
 * 1:1 of `dD` minus vendor gate. `coachGraphqlDoc` is the bundled GraphQL
 * document `cD` (prototype: decoded string f2(214), always present).
 * F2 status: the doc text has not been extracted into this repo yet, so
 * until it is, coach items are logged and SKIPPED without aborting the
 * run (an earlier clone build threw here, which killed the whole
 * Promise.all run — that failure mode exists in neither the prototype
 * nor this build). Extracting cD from the bundle completes this branch.
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
  // F3: prototype caller shows the progress toast when lecture items
  // exist — `<div>Progress: <span id="progress">0</span>/{total}</div>`.
  if (lectures.length > 0) {
    showProgressToast(
      `<div>Progress: <span id="progress">0</span>/${lectures.length}</div>`
    );
  }

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
          // F2 stopgap (see resolveWeekMaterial doc): never abort the run
          // over the not-yet-extracted cD document.
          log.error("runBranch", "coach item skipped — bundled GraphQL doc cD not yet extracted", {
            courseId, itemId: w.id
          });
          return;
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
  // Reload parity: in the prototype the CALLER reloads after dD resolves
  // (await dD(); sleep(1000); location.reload()). The clone's caller is
  // src/content/main.ts, which does exactly that — dD itself returns here.
}
