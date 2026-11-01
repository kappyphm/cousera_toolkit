// Assignment part extraction against the real saved Capstone page
// (an AI-graded assignment with file-upload parts only).
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFixture } from "./helpers.mjs";
import { extractTextParts, extractFileParts } from "../src/content/features/question-extract.ts";

test("Capstone assignment: 0 text parts, exactly 4 file parts", () => {
  loadFixture(
    "AI-Graded_Assignment__Capstone_Project_Planning_Deliverables___Coursera.html",
    "https://www.coursera.org/learn/course/assignment-submission/x/submit"
  );
  assert.equal(extractTextParts().length, 0);
  const files = extractFileParts();
  assert.equal(files.length, 4);
  for (const p of files) {
    assert.ok(p.responseId, "file part has a responseId");
    assert.ok(p.container, "file part exposes its container (uploader root)");
  }
});
