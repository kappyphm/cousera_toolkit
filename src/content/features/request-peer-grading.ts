// 1:1 clone of prototype `d2 as requestGradingByPeer` @ 752402.
// Origin: prototype/assets/chunk-674d105d.js, analysis/v2/02-auto-grade-disable-ai-grading.md
// Guard /learn/ -> branchId from body script -> fg() metadata -> GET permissions
// -> submissionId -> POST graphql-gateway RequestGradingByPeer (array envelope)
// -> reload on 200. Vendor gate Cr() replaced by noop (clone has no license).
import { getMetadata } from "../../platform/coursera-api.ts";
import { CloneError, createLogger } from "../../platform/logger.ts";

const log = createLogger("request-peer-grading");

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

const BRANCH_PATTERN = /(\d+~[A-Za-z0-9-_]+)/;

/**
 * branchId = the digits before "~" in the page's embedded branch
 * marker. Prototype reads exactly `body > script:nth-child(3)`; that
 * stays the primary path. Fallback (issue #32): if the marker script
 * is not at child 3 — its position depends on the page's other body
 * children — scan every script in the body with the same regex
 * before giving up.
 */
export function findBranchId(): string | undefined {
  const primary =
    (document.querySelector("body > script:nth-child(3)") as HTMLElement | null)?.innerText ?? "";
  const hit = primary.match(BRANCH_PATTERN)?.[1];
  if (hit) return hit.split("~")[0];
  for (const s of Array.from(document.querySelectorAll("body script"))) {
    const m = (s.textContent ?? "").match(BRANCH_PATTERN)?.[1];
    if (m) {
      log.warn("branchId", "primary script position missed — fallback scan found the marker");
      return m.split("~")[0];
    }
  }
  return undefined;
}

/** 1:1 of `d2` — force Coursera to route submission to human peer grading. */
export async function requestGradingByPeer(): Promise<void> {
  log.info("request", "requestGradingByPeer — start");

  // Guard: must be on a course page.
  if (!location.href.includes("/learn/")) {
    const msg = "This is not a course page, please go to your course page first";
    log.error("request", "guard failed — not /learn/", { href: location.href });
    // Prototype: alert(msg); return. Keep alert for parity.
    alert(msg);
    return;
  }

  // branchId from the embedded branch marker (see findBranchId).
  const branchId = findBranchId();
  if (!branchId) {
    throw new CloneError("branchId not found in body script", {
      module: "request-grading-by-peer",
      step: "branchId",
      href: location.href
    });
  }

  const meta = getMetadata();
  log.info("request", `branchId=${branchId}`, {
    courseId: meta.course_id,
    itemId: meta.item_id
  });

  // GET PeerAssignmentPermissions -> submissionId.
  // Exact URL from prototype ln(142) + branchId + course_id + item_id + fields.
  const permUrl =
    "https://www.coursera.org/api/onDemandPeerAssignmentPermissions.v1/" +
    branchId + "~" + meta.course_id + "~" + meta.item_id +
    "/?fields=deleteSubmission%2ClistSubmissions%2CreviewPeers%2CviewReviewSchema%2CanonymousPeerReview%2ConDemandPeerSubmissionProgresses.v1(latestSubmissionSummary%2ClatestDraftSummary%2ClatestAttemptSummary)%2ConDemandPeerReceivedReviewProgresses.v1(evaluationIfReady%2CearliestCompletionTime%2CreviewCount%2CdefaultReceivedReviewRequiredCount)%2ConDemandPeerDisplayablePhaseSchedules.v1(currentPhase%2CphaseEnds%2CphaseStarts)&includes=receivedReviewsProgress%2CsubmissionProgress%2CphaseSchedule";

  log.info("request", "GET PeerAssignmentPermissions", { branchId, courseId: meta.course_id, itemId: meta.item_id });
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
    log.error("request", "latestSubmissionSummary.id missing — continuing like prototype", {
      branchId,
      courseId: meta.course_id,
      itemId: meta.item_id,
      linkedKeys: Object.keys(body?.linked ?? {})
    });
  }
  log.info("request", `submissionId=${String(submissionId)}`, { branchId, courseId: meta.course_id });

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
  log.info("request", "POST RequestGradingByPeer", { branchId, courseId: meta.course_id, submissionId });
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
      log.info("request", "mutation ok — reloading");
      location.reload();
    } else {
      const text = await gqlRes.text().catch(() => "");
      log.error("request", `mutation status=${gqlRes.status} (prototype: silent, no reload)`, {
        status: gqlRes.status,
        body: text.slice(0, 500)
      });
    }
  } catch (e) {
    log.error("request", "mutation fetch failed (prototype: console.log only)", {
      error: (e as Error).message
    });
  }
}
