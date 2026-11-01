// Auto-quiz extraction (Qz/buildTerm) against real saved quiz pages,
// going through the PRODUCTION container/question finders (issue #32
// tiers). If Coursera changes the quiz markup, these are the canary.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFixture } from "./helpers.mjs";
import { buildTerm, findQuizContainers } from "../src/content/auto-quiz.ts";

const ATTEMPT_URL = "https://www.coursera.org/learn/course/quiz/attempt";

test("Module 2 Quiz: 10 radio questions, 34 options in total", () => {
  loadFixture("Module_2_Quiz___Coursera.html", ATTEMPT_URL);
  const cs = findQuizContainers();
  assert.equal(cs.length, 10);
  const terms = cs.map(buildTerm);
  assert.ok(terms.every((t) => t.term.startsWith("radio, ")), "all questions are radio");
  const totalOptions = terms.reduce((n, t) => n + (t.term.split("|").length - 1), 0);
  assert.equal(totalOptions, 34);
  // Golden text: the cml-viewer tier must yield the exact question the
  // legacy hash-class selector produced (Gemini matching depends on it).
  assert.ok(terms[0].term.includes("True or False: A project manager spends 75% of his or her time communicating."));
});

test("Advanced Argument Quiz: 5 radio + 2 checkbox questions", () => {
  loadFixture("Advanced_Argument_Quiz___Coursera.html", ATTEMPT_URL);
  const terms = findQuizContainers().map(buildTerm);
  assert.equal(terms.length, 7);
  assert.equal(terms.filter((t) => t.term.startsWith("radio, ")).length, 5);
  assert.equal(terms.filter((t) => t.term.startsWith("checkbox, ")).length, 2);
  assert.ok(terms[0].term.includes("What is a good way to make your academic essays longer?"));
});

test("Citing Sources cover page: 0 containers before the attempt opens", () => {
  // This saved page is the quiz cover (not an in-attempt page), so the
  // extractor must find nothing — the start-attempt step runs first.
  loadFixture("Citing_Sources_and_Formatting_Quiz___Coursera.html", ATTEMPT_URL);
  assert.equal(findQuizContainers().length, 0);
});
