// Auto-quiz extraction (Qz/buildTerm) against real saved quiz pages.
// If Coursera changes the quiz markup, these counts are the canary.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFixture } from "./helpers.mjs";
import { buildTerm } from "../src/content/auto-quiz.ts";

const CONTAINER_SELECTOR = ".css-1hhf6i, .rc-FormPartsQuestion";
const ATTEMPT_URL = "https://www.coursera.org/learn/course/quiz/attempt";

function containers() {
  return [...document.querySelectorAll(CONTAINER_SELECTOR)];
}

test("Module 2 Quiz: 10 radio questions, 34 options in total", () => {
  loadFixture("Module_2_Quiz___Coursera.html", ATTEMPT_URL);
  const cs = containers();
  assert.equal(cs.length, 10);
  const terms = cs.map(buildTerm);
  assert.ok(terms.every((t) => t.term.startsWith("radio, ")), "all questions are radio");
  const totalOptions = terms.reduce((n, t) => n + (t.term.split("|").length - 1), 0);
  assert.equal(totalOptions, 34);
  assert.ok(terms.every((t) => t.term.length > "radio, ".length + 3), "no empty questions");
});

test("Advanced Argument Quiz: 5 radio + 2 checkbox questions", () => {
  loadFixture("Advanced_Argument_Quiz___Coursera.html", ATTEMPT_URL);
  const terms = containers().map(buildTerm);
  assert.equal(terms.length, 7);
  assert.equal(terms.filter((t) => t.term.startsWith("radio, ")).length, 5);
  assert.equal(terms.filter((t) => t.term.startsWith("checkbox, ")).length, 2);
});

test("Citing Sources cover page: 0 containers before the attempt opens", () => {
  // This saved page is the quiz cover (not an in-attempt page), so the
  // extractor must find nothing — the start-attempt step runs first.
  loadFixture("Citing_Sources_and_Formatting_Quiz___Coursera.html", ATTEMPT_URL);
  assert.equal(containers().length, 0);
});
