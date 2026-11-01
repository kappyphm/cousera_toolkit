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

/**
 * A summary field in the live response is a WRAPPER object
 * { summary, computed } (verified from the panel digest, 2026-11-01:
 * latestSubmissionSummary={keys: summary,computed}) — there is no
 * direct .id on it; the referenced resource's data sits one hop
 * deeper, under one of the two keys.
 */
interface SummaryWrapper {
  summary?: Record<string, unknown> | null;
  computed?: Record<string, unknown> | null;
}

interface SubmissionProgressEntry {
  itemId?: string;
  id?: string;
  userId?: number;
  courseId?: string;
  latestSubmissionSummary?: SummaryWrapper | null;
  latestAttemptSummary?: SummaryWrapper | null;
  latestDraftSummary?: SummaryWrapper | null;
}

interface PermissionsBody {
  errorCode?: string;
  linked?: {
    // The API's linked key is the FLAT string including the version
    // suffix — exactly what the prototype's decoder recorded
    // (analysis/v2/02 §2.2: e(107) = "onDemandPeerSubmissionProgresses.v1").
    // An earlier clone build nested it as
    // linked.onDemandPeerSubmissionProgresses["v1"], a key that does
    // not exist in the real response (verified live 2026-11-01), so
    // the id read was undefined on every item.
    "onDemandPeerSubmissionProgresses.v1"?: Array<SubmissionProgressEntry | null>;
  };
}

const SUMMARY_KEYS = [
  "latestSubmissionSummary",
  "latestAttemptSummary",
  "latestDraftSummary"
] as const;

/** The two real keys of a summary wrapper, in resolution order. */
const ID_HOPS = ["summary", "computed"] as const;

/**
 * Submission id for the RequestGradingByPeer mutation. The
 * prototype's raw chain (analysis/v2/02 §2.2) has exactly TWO inner
 * hops after the entry — entry -> latestSubmissionSummary -> <hop>
 * -> .id — but the doc's decode labels for those hops contradict
 * each other (one is labelled "[0]", the other
 * ".latestSubmissionSummary"), and past clone builds each flattened
 * it differently (one read .computed.id; the F1 audit then read .id
 * directly). Live evidence (2026-11-01) fixes the shape: the
 * summary is a { summary, computed } wrapper. The extractor tries
 * the wrapper's two real keys in order and reports which one
 * supplied the id, so the choice is observable in the run log
 * rather than assumed; the failure digest prints both hops' ids.
 */
export function submissionIdFromPermissions(
  body: PermissionsBody | null | undefined
): { id: string; source: string } | null {
  const entry = body?.linked?.["onDemandPeerSubmissionProgresses.v1"]?.[0];
  const wrapper = entry?.latestSubmissionSummary;
  if (!wrapper) return null;
  for (const hop of ID_HOPS) {
    const id = wrapper[hop]?.id;
    if (typeof id === "string" && id.length > 0) {
      return { id, source: `latestSubmissionSummary.${hop}` };
    }
  }
  return null;
}

/** One summary wrapper's shape, one level deep (keys + id values). */
function describeWrapper(w: SummaryWrapper | null | undefined): string {
  if (w === undefined) return "absent";
  if (w === null) return "null";
  const parts = ID_HOPS.map((hop) => {
    const sub = w[hop];
    if (sub === undefined) return `${hop}=absent`;
    if (sub === null) return `${hop}=null`;
    const id = sub.id;
    return `${hop}={keys: ${Object.keys(sub).join(",") || "(none)"}; id: ${
      typeof id === "string" ? id : "absent"
    }}`;
  });
  return `{${parts.join("; ")}}`;
}

/** Compact shape digest of the permissions response, for logs. */
function describeEntry(body: PermissionsBody | null | undefined): string {
  if (body?.errorCode) return `errorCode=${body.errorCode}`;
  const entries = body?.linked?.["onDemandPeerSubmissionProgresses.v1"];
  const entry = Array.isArray(entries) ? entries[0] : undefined;
  if (!entry) {
    const keys = Object.keys(body?.linked ?? {}).join(",");
    return `linked keys: ${keys || "(none)"}; no submission-progress entry`;
  }
  const summaries = SUMMARY_KEYS.map((s) => `${s}=${describeWrapper(entry[s])}`).join("; ");
  return `entry keys: ${Object.keys(entry).join(",")}; ${summaries}`;
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
  log.info("request", `GET PeerAssignmentPermissions status=${res.status}`, {
    status: res.status
  });
  const body = (await res.json()) as PermissionsBody;
  // Prototype chain (analysis/v2/02 §2.2): the raw bundle code hops
  // entry -> latestSubmissionSummary -> <one more hop> -> .id. The
  // doc's one-line summary flattened that last hop away, and past
  // clone builds inherited the flattening (plus a nested linked key
  // the live response disproved). See submissionIdFromPermissions
  // for the live-verified wrapper shape.
  const found = submissionIdFromPermissions(body);
  if (!found) {
    // The prototype sends the mutation anyway here (submissionId
    // undefined, JSON.stringify drops the key -> a guaranteed 400).
    // Stop with the response shape in the message instead (issue
    // #41), so the panel log alone shows whether the GET was refused
    // (errorCode) or the item simply has no submission summary.
    throw new CloneError(
      `no submission id in PeerAssignmentPermissions response (${describeEntry(body)})`,
      { module: "request-grading-by-peer", step: "submissionId", href: location.href }
    );
  }
  const submissionId = found.id;
  log.info("request", `submissionId=${submissionId} (source: ${found.source})`, {
    branchId,
    courseId: meta.course_id,
    source: found.source
  });

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
      // Body excerpt in the message itself (issue #41): the panel's
      // text log is what gets pasted for diagnosis, and the GraphQL
      // error body names the exact rejected field.
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
