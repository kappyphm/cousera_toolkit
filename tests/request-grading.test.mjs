// d2 (request grading by peer) submission-id extraction (issue #41).
// The prototype reads only latestSubmissionSummary.id, which the
// current API returns empty for an AI-graded submission (live log
// 2026-11-01: mutation sent with submissionId undefined -> HTTP 400).
// The extractor walks the three summaries the prototype's own fields
// projection requests, in order, and reports which one supplied the
// id. Pure function — no DOM needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { submissionIdFromPermissions } from "../src/content/features/request-peer-grading.ts";

const wrap = (entry) => ({
  linked: { onDemandPeerSubmissionProgresses: { v1: [entry] } }
});

test("latestSubmissionSummary wins (the prototype path)", () => {
  const body = wrap({
    latestSubmissionSummary: { id: "sub-1" },
    latestAttemptSummary: { id: "att-1" },
    latestDraftSummary: { id: "draft-1" }
  });
  assert.deepEqual(submissionIdFromPermissions(body), {
    id: "sub-1",
    source: "latestSubmissionSummary"
  });
});

test("falls back to latestAttemptSummary when the summary is empty", () => {
  for (const empty of [null, undefined, {}, { id: "" }]) {
    const body = wrap({
      latestSubmissionSummary: empty,
      latestAttemptSummary: { id: "att-1" },
      latestDraftSummary: { id: "draft-1" }
    });
    assert.deepEqual(submissionIdFromPermissions(body), {
      id: "att-1",
      source: "latestAttemptSummary"
    });
  }
});

test("falls back to latestDraftSummary as the last resort", () => {
  const body = wrap({
    latestSubmissionSummary: null,
    latestAttemptSummary: null,
    latestDraftSummary: { id: "draft-1" }
  });
  assert.deepEqual(submissionIdFromPermissions(body), {
    id: "draft-1",
    source: "latestDraftSummary"
  });
});

test("null when no summary carries an id", () => {
  assert.equal(
    submissionIdFromPermissions(
      wrap({ latestSubmissionSummary: null, latestAttemptSummary: {}, latestDraftSummary: null })
    ),
    null
  );
  assert.equal(submissionIdFromPermissions(wrap({})), null);
  assert.equal(submissionIdFromPermissions(wrap(null)), null);
});

test("null on malformed bodies, without throwing", () => {
  for (const bad of [
    null,
    undefined,
    {},
    { linked: {} },
    { linked: { onDemandPeerSubmissionProgresses: {} } },
    { linked: { onDemandPeerSubmissionProgresses: { v1: [] } } },
    wrap({ latestSubmissionSummary: { id: 42 } })
  ]) {
    assert.equal(submissionIdFromPermissions(bad), null);
  }
});
