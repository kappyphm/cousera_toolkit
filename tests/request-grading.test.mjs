// d2 (request grading by peer) — strict prototype parity (issue #41,
// user direction 2026-11-01). The bundle's read is a single exact
// chain: linked["onDemandPeerSubmissionProgresses.v1"][0]
//   .latestSubmissionSummary.summary.id
// with ==null guards that yield undefined (and the mutation is still
// sent). Live-verified shape history: the linked key is FLAT; an
// item with no submission returns an entry with no summaries; an
// item with a submission returns the summary as a { summary,
// computed } WRAPPER. These tests pin the exact read — including
// that computed.id is NOT used as a fallback (the bundle has none).
import { test } from "node:test";
import assert from "node:assert/strict";
import { submissionIdFromPermissions } from "../src/content/features/request-peer-grading.ts";

const wrap = (entry) => ({
  linked: { "onDemandPeerSubmissionProgresses.v1": [entry] }
});

test("reads latestSubmissionSummary.summary.id (the bundle's chain)", () => {
  const body = wrap({
    itemId: "item1",
    id: "111~course1~item1",
    userId: 111,
    courseId: "course1",
    latestSubmissionSummary: {
      summary: { id: "sub-1", state: "submitted" },
      computed: { grade: 0 }
    }
  });
  assert.equal(submissionIdFromPermissions(body), "sub-1");
});

test("no fallback: computed.id alone does NOT yield an id", () => {
  const body = wrap({
    latestSubmissionSummary: {
      summary: { state: "submitted" },
      computed: { id: "sub-2" }
    }
  });
  assert.equal(submissionIdFromPermissions(body), undefined);
});

test("undefined for the real no-submission entry shape (no summaries)", () => {
  // Verbatim structure of the live response captured 2026-11-01.
  const body = wrap({
    itemId: "gFDPY",
    id: "160106218~A2RSXymKEeWJTQ5-ju9xSw~gFDPY",
    userId: 160106218,
    courseId: "A2RSXymKEeWJTQ5-ju9xSw"
  });
  assert.equal(submissionIdFromPermissions(body), undefined);
});

test("undefined for the old nested-key shape (a clone transcription bug)", () => {
  const body = {
    linked: {
      onDemandPeerSubmissionProgresses: {
        v1: [{ latestSubmissionSummary: { summary: { id: "sub-1" } } }]
      }
    }
  };
  assert.equal(submissionIdFromPermissions(body), undefined);
});

test("undefined on error bodies and malformed responses, without throwing", () => {
  for (const bad of [
    null,
    undefined,
    {},
    { errorCode: "Not Authorized", message: null, details: null },
    { linked: {} },
    { linked: { "onDemandPeerSubmissionProgresses.v1": [] } },
    wrap(null),
    wrap({ latestSubmissionSummary: null })
  ]) {
    assert.equal(submissionIdFromPermissions(bad), undefined);
  }
});
