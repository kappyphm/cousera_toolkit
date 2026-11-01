// d2 (request grading by peer) submission-id extraction (issue #41).
// Shape history, all live-verified 2026-11-01:
//  - The linked key is FLAT: linked["onDemandPeerSubmissionProgresses.v1"]
//    (an earlier clone build nested it and read undefined everywhere).
//  - An item with no submission returns an entry with only
//    { itemId, id, userId, courseId } — no summaries at all.
//  - An item WITH a submission returns summaries as WRAPPERS:
//    latestSubmissionSummary = { summary: {...}, computed: {...} }
//    (panel digest: "latestSubmissionSummary={keys: summary,computed}").
//    The id sits one hop deeper, under summary or computed; the
//    extractor tries both in order and reports the source.
import { test } from "node:test";
import assert from "node:assert/strict";
import { submissionIdFromPermissions } from "../src/content/features/request-peer-grading.ts";

const wrap = (entry) => ({
  linked: { "onDemandPeerSubmissionProgresses.v1": [entry] }
});

test("reads the id from latestSubmissionSummary.summary", () => {
  const body = wrap({
    itemId: "item1",
    id: "111~course1~item1",
    userId: 111,
    courseId: "course1",
    latestSubmissionSummary: {
      summary: { id: "sub-1", state: "submitted" },
      computed: { grade: 0 }
    },
    latestDraftSummary: { summary: {}, computed: {} }
  });
  assert.deepEqual(submissionIdFromPermissions(body), {
    id: "sub-1",
    source: "latestSubmissionSummary.summary"
  });
});

test("falls back to latestSubmissionSummary.computed when summary has no id", () => {
  const body = wrap({
    latestSubmissionSummary: {
      summary: { state: "submitted" },
      computed: { id: "sub-2" }
    }
  });
  assert.deepEqual(submissionIdFromPermissions(body), {
    id: "sub-2",
    source: "latestSubmissionSummary.computed"
  });
});

test("null when neither hop of the wrapper carries an id", () => {
  for (const wrapper of [
    { summary: {}, computed: {} },
    { summary: null, computed: null },
    { summary: { id: "" }, computed: { id: 42 } },
    {},
    null
  ]) {
    assert.equal(
      submissionIdFromPermissions(wrap({ latestSubmissionSummary: wrapper })),
      null
    );
  }
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

test("null for the old nested-key shape (the transcription bug)", () => {
  const body = {
    linked: {
      onDemandPeerSubmissionProgresses: {
        v1: [{ latestSubmissionSummary: { summary: { id: "sub-1" } } }]
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
