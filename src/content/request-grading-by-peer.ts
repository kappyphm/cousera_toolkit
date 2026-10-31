// 1:1 clone of prototype `d2 as requestGradingByPeer` @ 752402.
// Origin: prototype/assets/chunk-674d105d.js, analysis/v2/02-auto-grade-disable-ai-grading.md
// Guard /learn/ -> branchId from body script -> fg() metadata -> GET permissions
// -> submissionId -> POST graphql-gateway RequestGradingByPeer (array envelope)
// -> reload on 200. Vendor gate Cr() replaced by noop (clone has no license).
import { getMetadata } from "../shared/coursera.ts";
import { CloneError, createLogger } from "../shared/logger.ts";

const log = createLogger("request-grading-by-peer");

/** Exact mutation document from prototype `n.JpbYk` (verbatim). */
const MUTATION = `mutation RequestGradingByPeer($input: PeerReviewAi_RequestGradingByPeerInput!) {
  PeerReviewAi_RequestGradingByPeer(input: $input) {
    submissionId
    __typename
  }
}
`;

interface PermissionsBody {
  linked?: {
    onDemandPeerSubmissionProgresses?: {
      "v1"?: Array<{
        latestSubmissionSummary?: { id?: string };
      }>;
    };
  };
}

/** Clone of prototype vendor gate `Cr as getSource` — no license check. */
function gate(): void {
  log.debug("gate", "Cr() vendor gate — noop in clone");
}

/** 1:1 of `d2` — force Coursera to route submission to human peer grading. */
export async function requestGradingByPeer(): Promise<void> {
  log.info("d2", "requestGradingByPeer — start");

  // Guard: must be on a course page.
  if (!location.href.includes("/learn/")) {
    const msg = "This is not a course page, please go to your course page first";
    log.error("d2", "guard failed — not /learn/", { href: location.href });
    // Prototype: alert(msg); return. Keep alert for parity.
    alert(msg);
    return;
  }

  // branchId from embedded script tag body (regex verbatim).
  const scriptText =
    (document.querySelector("body > script:nth-child(3)") as HTMLElement | null)?.innerText ?? "";
  const m = scriptText.match(/(\d+~[A-Za-z0-9-_]+)/);
  const branchId = m?.[1]?.split("~")[0];
  if (!branchId) {
    throw new CloneError("branchId not found in body script", {
      module: "request-grading-by-peer",
      step: "branchId",
      href: location.href
    });
  }

  const meta = getMetadata();
  log.info("d2", `branchId=${branchId}`, {
    courseId: meta.course_id,
    itemId: meta.item_id
  });

  // GET PeerAssignmentPermissions -> submissionId.
  // Exact URL from prototype ln(142) + branchId + course_id + item_id + fields.
  const permUrl =
    "https://www.coursera.org/api/onDemandPeerAssignmentPermissions.v1/" +
    branchId + "~" + meta.course_id + "~" + meta.item_id +
    "/?fields=deleteSubmission%2ClistSubmissions%2CreviewPeers%2CviewReviewSchema%2CanonymousPeerReview%2ConDemandPeerSubmissionProgresses.v1(latestSubmissionSummary%2ClatestDraftSummary%2ClatestAttemptSummary)%2ConDemandPeerReceivedReviewProgresses.v1(evaluationIfReady%2CearliestCompletionTime%2CreviewCount%2CdefaultReceivedReviewRequiredCount)%2ConDemandPeerDisplayablePhaseSchedules.v1(currentPhase%2CphaseEnds%2CphaseStarts)&includes=receivedReviewsProgress%2CsubmissionProgress%2CphaseSchedule";

  log.info("d2", "GET PeerAssignmentPermissions", { branchId, courseId: meta.course_id, itemId: meta.item_id });
  // Prototype: fetch(...).then(l => l.json()).then(chain) — NO res.ok check;
  // a JSON parse failure rejects d2 exactly like the prototype chain does.
  const res = await fetch(permUrl, { method: "GET" });
  const body = (await res.json()) as PermissionsBody;
  // Prototype chain (decoded verbatim, analysis/v2/02 §2.2):
  // linked.onDemandPeerSubmissionProgresses.v1[0].latestSubmissionSummary.id
  // (F1 fix: an earlier clone build read `.computed.id`, which appears
  // nowhere in the decoded prototype evidence.)
  const submissionId =
    body?.linked?.onDemandPeerSubmissionProgresses?.["v1"]?.[0]?.latestSubmissionSummary?.id;
  if (!submissionId) {
    // Prototype does not branch here: `a` is simply undefined and the
    // mutation below is still sent (JSON.stringify drops the key).
    log.error("d2", "latestSubmissionSummary.id missing — continuing like prototype", {
      branchId,
      courseId: meta.course_id,
      itemId: meta.item_id,
      linkedKeys: Object.keys(body?.linked ?? {})
    });
  }
  log.info("d2", `submissionId=${String(submissionId)}`, { branchId, courseId: meta.course_id });

  // Vendor gate (clone noop).
  gate();

  // GraphQL mutation — prototype posts an ARRAY envelope, reason string ln(162).
  const gqlUrl = "https://www.coursera.org/graphql-gateway?opname=RequestGradingByPeer";
  const gqlBody = [
    {
      operationName: "RequestGradingByPeer",
      variables: {
        input: {
          courseId: meta.course_id,
          itemId: meta.item_id,
          submissionId,
          reason: "EXPECTED_HIGHER_SCORE|ok"
        }
      },
      query: MUTATION
    }
  ];
  log.info("d2", "POST RequestGradingByPeer", { branchId, courseId: meta.course_id, submissionId });
  // Prototype: fetch(...).then(l => { if (l.status === 200) location.reload() })
  // .catch(l => console.log(l)) — non-200 is silent, network errors are
  // only logged. No throw (parity fix).
  try {
    const gqlRes = await fetch(gqlUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gqlBody)
    });
    if (gqlRes.status === 200) {
      log.info("d2", "mutation ok — reloading");
      location.reload();
    } else {
      const text = await gqlRes.text().catch(() => "");
      log.error("d2", `mutation status=${gqlRes.status} (prototype: silent, no reload)`, {
        status: gqlRes.status,
        body: text.slice(0, 500)
      });
    }
  } catch (e) {
    log.error("d2", "mutation fetch failed (prototype: console.log only)", {
      error: (e as Error).message
    });
  }
}
