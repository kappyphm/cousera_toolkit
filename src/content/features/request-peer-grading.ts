// 1:1 clone of prototype `d2 as requestGradingByPeer` @ 752402.
// Origin: prototype/assets/chunk-674d105d.js, analysis/v2/02-auto-grade-disable-ai-grading.md
// Guard /learn/ -> branchId from body script -> fg() metadata -> GET permissions
// -> submissionId -> POST graphql-gateway RequestGradingByPeer (array envelope)
// -> reload on 200. Vendor gate Cr() replaced by noop (clone has no license).
//
// Strict-parity restoration (issue #41, user direction 2026-11-01):
// this file previously accumulated deviations that the bundle does
// not have — a fallback branchId scan (issue #32), a nested linked
// key, a flattened submissionId read, a guessed summary fallback and
// a hard stop before the mutation. Live verification against
// Coursera's real responses showed the bundle's own logic matches
// today's API hop for hop; every deviation is removed below, and the
// reads follow the raw decoded chain in analysis/v2/02 §2.1–§2.3.
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

interface SummaryInner {
  id?: string;
}

/**
 * The summary fields of a submission-progress entry are WRAPPER
 * objects in the live response (verified 2026-11-01):
 * latestSubmissionSummary = { summary: {...}, computed: {...} }.
 * The bundle reads through `summary`; `computed` is typed only
 * because it is present in the payload.
 */
interface SummaryWrapper {
  summary: SummaryInner;
  computed?: SummaryInner | null;
}

interface SubmissionProgressEntry {
  latestSubmissionSummary?: SummaryWrapper | null;
}

interface PermissionsBody {
  linked?: {
    // Flat key including the version suffix — the bundle's decoder
    // records e(107) = "onDemandPeerSubmissionProgresses.v1", and
    // the live response confirms the key is flat, not nested.
    "onDemandPeerSubmissionProgresses.v1"?: Array<SubmissionProgressEntry | null>;
  };
}

/**
 * The bundle's submissionId read, hop for hop (raw chain in
 * analysis/v2/02 §2.2): linked -> "onDemandPeerSubmissionProgresses.v1"
 * -> [0] -> latestSubmissionSummary -> summary -> .id, with the
 * bundle's own ==null guards — a missing linked/entry/summary yields
 * undefined and the mutation is STILL sent (the bundle has no branch
 * there). The analysis doc's one-line summary flattened the `summary`
 * hop away; that flattening, plus a nested linked key, is what made
 * every earlier clone build read undefined. One softening vs the
 * bundle: a missing linked KEY yields undefined here where the
 * bundle's unguarded [0] would throw — same visible outcome (no id),
 * kept so the failure stays a readable log line.
 */
export function submissionIdFromPermissions(
  body: PermissionsBody | null | undefined
): string | undefined {
  const linked = body?.linked;
  if (linked == null) return undefined;
  const entry = linked["onDemandPeerSubmissionProgresses.v1"]?.[0];
  if (entry == null) return undefined;
  const wrapper = entry.latestSubmissionSummary;
  if (wrapper == null) return undefined;
  return wrapper.summary.id;
}

/** Clone of prototype vendor gate `Cr as getSource` — no license check. */
function gate(): void {
  log.debug("gate", "Cr() vendor gate — noop in clone");
}

const BRANCH_PATTERN = /(\d+~[A-Za-z0-9-_]+)/;

/**
 * branchId — the bundle reads exactly `body > script:nth-child(3)`
 * (analysis/v2/02 §2.1): a missing script element aborts the flow
 * (the bundle throws reading the text of nothing — mirrored here as
 * a CloneError), and a regex miss yields undefined, with which the
 * flow CONTINUES (the permissions URL is built with it). The
 * issue-#32 fallback scan over all body scripts was removed
 * 2026-11-01 at the user's direction: strict prototype parity.
 */
export function findBranchId(): string | undefined {
  const el = document.querySelector(
    "body > script:nth-child(3)"
  ) as HTMLElement | null;
  if (!el) {
    throw new CloneError(
      "branch marker script not found (body > script:nth-child(3))",
      { module: "request-grading-by-peer", step: "branchId", href: location.href }
    );
  }
  const hit = el.innerText.match(BRANCH_PATTERN)?.[1];
  return hit?.split("~")[0];
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

  const meta = getMetadata();
  log.info("request", `branchId=${String(branchId)}`, {
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
  log.debug("request", `GET status=${res.status}`, { status: res.status });
  // Prototype chain (raw bundle code, analysis/v2/02 §2.2) — see
  // submissionIdFromPermissions for the hop-by-hop mapping. Like the
  // bundle, an undefined result does NOT stop the flow.
  const submissionId = submissionIdFromPermissions(body);
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
      log.error(
        "request",
        `mutation status=${gqlRes.status} body=${text.slice(0, 200)} (prototype: silent, no reload)`,
        { status: gqlRes.status, body: text.slice(0, 500) }
      );
    }
  } catch (e) {
    log.error("request", "mutation fetch failed (prototype: console.log only)", {
      error: (e as Error).message
    });
  }
}
