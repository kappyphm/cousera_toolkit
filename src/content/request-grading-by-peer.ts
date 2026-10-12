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
        latestSubmissionSummary?: { computed?: { id?: string } };
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
  const res = await fetch(permUrl, { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CloneError(`PeerAssignmentPermissions fetch failed status=${res.status}`, {
      module: "request-grading-by-peer",
      step: "permissions",
      branchId,
      courseId: meta.course_id,
      itemId: meta.item_id,
      status: res.status,
      body: text.slice(0, 500)
    });
  }
  const body = (await res.json()) as PermissionsBody;
  // Prototype chain: linked.onDemandPeerSubmissionProgresses.v1[0].latestSubmissionSummary.computed.id
  const submissionId =
    body?.linked?.onDemandPeerSubmissionProgresses?.["v1"]?.[0]?.latestSubmissionSummary?.computed?.id;
  if (!submissionId) {
    throw new CloneError("latestSubmissionSummary.computed.id missing", {
      module: "request-grading-by-peer",
      step: "permissions",
      branchId,
      courseId: meta.course_id,
      itemId: meta.item_id,
      linkedKeys: Object.keys(body?.linked ?? {})
    });
  }
  log.info("d2", `submissionId=${submissionId}`, { branchId, courseId: meta.course_id });

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
    log.error("d2", `mutation failed status=${gqlRes.status}`, {
      status: gqlRes.status,
      body: text.slice(0, 500)
    });
    throw new CloneError(`RequestGradingByPeer failed status=${gqlRes.status}`, {
      module: "request-grading-by-peer",
      step: "mutation",
      status: gqlRes.status,
      body: text.slice(0, 500)
    });
  }
}
