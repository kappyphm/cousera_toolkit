// Issue #32 selector repairs: branchId fallback (d2) and the
// AI-grading gate (hD) primary signal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDom, loadFixture } from "./helpers.mjs";
import { findBranchId } from "../src/content/features/request-peer-grading.ts";
import { hasAiGrading } from "../src/content/features/submit-assignment.ts";

const REVIEW_PAGE = "Submit_Your_Topic_and_Research_Questions___Coursera.html";
const PAGE_URL = "https://www.coursera.org/learn/course/peer/x/submit";

test("findBranchId: primary path on the real review page", () => {
  loadFixture(REVIEW_PAGE, PAGE_URL);
  assert.equal(findBranchId(), "160106218");
});

test("findBranchId: no fallback — marker off child 3 aborts like the bundle", () => {
  // The issue-#32 fallback scan was removed 2026-11-01 at the user's
  // direction: the bundle reads body > script:nth-child(3) only. When
  // that selector matches nothing, the bundle throws reading the
  // missing script's text; the clone mirrors the abort (CloneError).
  const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
  const html = readFileSync(path.join(fixtures, REVIEW_PAGE), "utf8");
  // Shift every body child down by two so the marker script is no
  // longer body > script:nth-child(3) (child 3 is now another node).
  const mutated = html.replace(/<body[^>]*>/, "$&<div></div><div></div>");
  assert.notEqual(mutated, html);
  createDom(mutated, PAGE_URL);
  assert.equal(document.querySelector("body > script:nth-child(3)"), null);
  assert.throws(() => findBranchId(), /branch marker script not found/);
});

test("findBranchId: script present but marker absent -> undefined, flow continues", () => {
  // The bundle's regex-miss path: r == null -> branchId undefined,
  // and d2 proceeds to build the permissions URL with it.
  createDom(
    `<!doctype html><html><body><div></div><div></div><script>var x = 1;</script></body></html>`,
    PAGE_URL
  );
  assert.equal(findBranchId(), undefined);
});

test("hasAiGrading: Switch-to-peer-grading button is a certain positive", async () => {
  createDom(
    '<!doctype html><html><body><button class="cds-button-primary">Switch to peer grading</button></body></html>',
    PAGE_URL
  );
  assert.equal(await hasAiGrading(), true);
});

test("hasAiGrading: false on the review page (no button, no disclosure)", async () => {
  loadFixture(REVIEW_PAGE, PAGE_URL);
  assert.equal(await hasAiGrading(), false);
});
