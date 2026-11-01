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

test("findBranchId: fallback scan when the marker script moves off child 3", () => {
  const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
  const html = readFileSync(path.join(fixtures, REVIEW_PAGE), "utf8");
  // Shift every body child down by two so the marker script is no
  // longer body > script:nth-child(3).
  const mutated = html.replace(/<body[^>]*>/, "$&<div></div><div></div>");
  assert.notEqual(mutated, html);
  createDom(mutated, PAGE_URL);
  const primary = document.querySelector("body > script:nth-child(3)")?.textContent ?? "";
  assert.ok(!/(\d+~[A-Za-z0-9-_]+)/.test(primary), "primary position must miss in the mutated DOM");
  assert.equal(findBranchId(), "160106218");
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
