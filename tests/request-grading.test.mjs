// d2 (request grading by peer) submission-id extraction (issue #41).
// The prototype's decoded read is
//   linked["onDemandPeerSubmissionProgresses.v1"][0].latestSubmissionSummary.id
// with a FLAT linked key (analysis/v2/02 §2.2, decoder e(107)). An
// earlier clone build nested the key as
// linked.onDemandPeerSubmissionProgresses["v1"], which does not exist
// in the real response — verified live 2026-11-01, where the genuine
// response for an item without a submission was:
//   linked: { "onDemandPeerSubmissionProgresses.v1":
//             [{ itemId, id, userId, courseId }] }   (no summaries)
// These tests pin the flat shape, the no-summary case, and that the
// old nested shape yields null rather than a phantom id.
import { test } from "node:test";
import assert from "node:assert/strict";
import { submissionIdFromPermissions } from "../src/content/features/request-peer-grading.ts";

const wrap = (entry) => ({
  linked: { "onDemandPeerSubmissionProgresses.v1": [entry] }
});

test("reads latestSubmissionSummary.id via the flat linked key (prototype path)", () => {
  const body = wrap({
    itemId: "item1",
    id: "111~course1~item1",
    userId: 111,
    courseId: "course1",
    latestSubmissionSummary: { id: "sub-1" }
  });
  assert.deepEqual(submissionIdFromPermissions(body), { id: "sub-1" });
});

test("null for the real no-submission entry shape (no summaries at all)", () => {
  // Verbatim structure of the live response captured 2026-11-01.
  const body = wrap({
    itemId: "gFDPY",
    id: "160106218~A2RSXymKEeWJTQ5-ju9xSw~gFDPY",
    userId: 160106218,
    courseId: "A2RSXymKEeWJTQ5-ju9xSw"
  });
  assert.equal(submissionIdFromPermissions(body), null);
});

test("null when the summary is present but carries no usable id", () => {
  for (const summary of [null, {}, { id: "" }, { id: 42 }]) {
    assert.equal(
      submissionIdFromPermissions(wrap({ latestSubmissionSummary: summary })),
      null
    );
  }
});

test("null for the old nested-key shape (the transcription bug)", () => {
  const body = {
    linked: {
      onDemandPeerSubmissionProgresses: {
        v1: [{ latestSubmissionSummary: { id: "sub-1" } }]
      }
    }
  };
  assert.equal(submissionIdFromPermissions(body), null);
});

test("null on error bodies and malformed responses, without throwing", () => {
  for (const bad of [
    null,
    undefined,
    {},
    { errorCode: "Not Authorized", message: null, details: null },
    { linked: {} },
    { linked: { "onDemandPeerSubmissionProgresses.v1": [] } },
    wrap(null)
  ]) {
    assert.equal(submissionIdFromPermissions(bad), null);
  }
});
