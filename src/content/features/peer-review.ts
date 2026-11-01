// 1:1 clone of prototype `_D as handleReview` @ 761766 + `Pd` @ 757644.
// Origin: prototype/assets/chunk-674d105d.js, analysis/v2/03-auto-peer-review.md
// Decoders: _D uses Sn (table ca, base 213); Pd uses Ke (table xa, base 267).
// Vendor gate Cr() replaced by noop (clone has no license), same as d2.
// Interpretation points (evidence gaps in analysis/v2/03, tracked in the
// GitHub issue for this port):
//  1. §3.4 does not decode Pd's submit selectors (a(290) container,
//     a(327) button). Fallback below uses mD's decoded submit selectors
//     at document level, plus a text-based fallback ("Submit Review")
//     grounded in a real current-UI review page (issue #28).
//  2. §3.3's textarea query holder is an ambiguous single-letter var;
//     ported at document scope (the submit feedback box is unique on
//     the review page).
//  3. §4.5 does not fix Cr()'s position inside _D; placed right after
//     the guard, matching dD/vD.
//  4. Current-UI adaptations (issue #28, evidence: a saved review page
//     from 2026-10-31): rubric groups are [role="radiogroup"] (the old
//     div[role="group"] is gone), the ready-wait anchor .css-2imjyh is
//     gone, and the §3.3 feedback match is now a WRAPPER div whose
//     editable is an inner textarea — the length==1 check stays on the
//     wrapper (its textContent is still exactly 1 zero-width char),
//     but focus must land on the inner textarea for insertText to work.
//  5. Orchestration rewritten (issue #38) around the current UI: the
//     hub is a separate entry page with three states, and reviews run
//     as a conveyor on /review-next (same URL, counter on the page).
//     The prototype's §4.2 click-through and §4.3/§4.4 loops target
//     the old flow and cannot work there. Pd is untouched — it was
//     verified live end-to-end on 2026-11-01 (counter 4 -> 3).
import { sleep, waitForSelector } from "../../platform/coursera-dom.ts";
import { findByText } from "../../platform/finder.ts";
import { createLogger } from "../../platform/logger.ts";

const log = createLogger("peer-review");

/** Clone of prototype vendor gate `Cr as getSource` — no license check. */
function gate(): void {
  log.debug("gate", "Cr() vendor gate — noop in clone");
}

/**
 * Fallback submit selector — NOT decoded from the prototype review flow
 * (analysis/v2/03 §3.4 leaves a(290)/a(327) undecoded). These are mD's
 * bundle-decoded submit selectors (analysis/v2/01 §3), reused until the
 * review-page pair is extracted from the bundle.
 */
const SUBMIT_SELECTOR =
  'button[aria-label="Submit"], button[data-e2e="submit-assignment"]';

/**
 * Submit-button finder. Primary: mD's bundle-decoded selectors (the
 * §3.4 pair was never decoded). Fallback (issue #28): the current
 * review UI's submit is a CDS button whose only stable hook is its
 * exact label "Submit Review" — no testid/aria-label/data-e2e.
 */
function findSubmitButton(): HTMLElement | null {
  const direct = document.querySelector<HTMLElement>(SUBMIT_SELECTOR);
  if (direct) return direct;
  return findByText<HTMLElement>("button", "Submit Review");
}

/** 1:1 of `Pd` — grade one peer item on the review page. */
async function gradeOnePeerItem(): Promise<void> {
  log.info("grade-one", "grade one peer item — start");

  // §3.1 Review container wait (se rejects on timeout, like prototype).
  // The decoded anchor (.css-2imjyh .css-7jkbgo a) no longer exists in
  // the current UI; the union also accepts the new review form's own
  // anchors so the wait resolves on either markup generation.
  await waitForSelector(
    '.css-2imjyh .css-7jkbgo a, .peer-option-input, div[data-testid="peer-review-multi-line-input-field"]',
    1000
  );

  // §3.2 Rubric group loop. Current UI groups options in
  // [role="radiogroup"] wrappers; div[role="group"] kept for old pages.
  const groups = document.querySelectorAll('div[role="group"], [role="radiogroup"]');
  log.info("grade-one", `rubric groups n=${groups.length}`);
  for (const a of groups) {
    const x = a.querySelectorAll<HTMLElement>(".option-contents > div:nth-child(1)");
    const nums = Array.from(
      a.querySelectorAll(".peer-option-input .cds-checkboxAndRadio-label")
    ).map((f) => {
      const g = f.textContent?.match(/\d+/);
      return g ? parseInt(g[0], 10) : 0;
    });
    if (x.length > 0) {
      // Decoded rule: max - min > 1 -> last option, else first option.
      const spread = nums.length > 0 ? Math.max(...nums) - Math.min(...nums) : 0;
      if (spread > 1) {
        log.debug("grade-one", `spread=${spread} > 1 — pick last option`, { nums });
        x[x.length - 1]?.click();
      } else {
        log.debug("grade-one", `spread=${spread} — pick first option`, { nums });
        x[0]?.click();
      }
    }
  }

  // §3.3 Feedback textarea — verbatim mechanism (raw execCommand,
  // "Good "), with one current-UI adaptation (issue #28): the matched
  // element is now a wrapper div, so after clicking it, focus goes to
  // the inner editable (textarea/contenteditable) when one exists —
  // insertText only lands where the caret is. On old markup the match
  // IS the field and behavior is unchanged.
  const u = document.querySelectorAll<HTMLElement>(
    '.c-peer-review-submit-textarea-input-field, div[data-testid="peer-review-multi-line-input-field"]'
  );
  for (const f of u) {
    if (f.textContent?.length === 1) {
      f.click();
      const editable =
        f.matches('textarea, [contenteditable="true"]')
          ? f
          : f.querySelector<HTMLElement>('textarea, [contenteditable="true"]');
      (editable ?? f).focus();
      document.execCommand("insertText", false, "Good ");
      log.debug("grade-one", 'feedback textarea filled with "Good "');
    }
  }

  // §3.4 Submit — prototype uses a bare setTimeout(700), NOT awaited:
  // Pd returns and the click lands 700ms later. Structure (find ->
  // scrollIntoView -> click) is the decoded one; the selector pair is
  // the flagged fallback above.
  setTimeout(() => {
    const y = findSubmitButton();
    if (y) {
      y.scrollIntoView();
      y.click();
      log.info("grade-one", "submit clicked (+700ms, prototype timing)");
    } else {
      log.warn("grade-one", "submit button not found at +700ms");
    }
  }, 700);

  log.info("grade-one", "grade one peer item — done");
}

// ---------------------------------------------------------------------
// Orchestration (issue #38) — replaces the prototype's §4.2 click-
// through, §4.3 URL-change loop and §4.4 hub counter loop, which all
// target the pre-2026 flow. Live evidence (2026-11-01, supervised on a
// real account): the hub (/give-feedback) is a separate entry page
// with three states — blocked ("Submit your project before reviewing
// classmates" + a "Go to my project" link, no Start Reviewing button),
// ready (counter + "Start Reviewing" at the page bottom) and complete
// (counter at 0, Start Reviewing still offered for extra reviews).
// Reviews themselves run as a conveyor on /review-next: submitting
// loads the NEXT submission at the same URL with no success banner,
// and the "N left to complete" counter is rendered on the review page
// itself. So the loop below keys on the counter + form replacement,
// never on URL changes or a return to the hub.
// ---------------------------------------------------------------------

export interface ReviewCounter {
  left: number;
  raw: string;
}

const LEFT_TO_COMPLETE_RE = /(\d+)\s+left to complete/i;
const COMPLETE_COUNT_RE = /(\d+)\s+complete\b/i;
const FINISHED_RE = /you(?:'|\u2019)ve finished your peer reviews/i;
const BLOCKED_MARKER = "submit your project before reviewing";

/**
 * Parse counter text. The complete forms ("N complete", the finished
 * banner) are only trusted on the hub — on a review page they could
 * appear in unrelated copy.
 */
function parseCounterText(text: string, allowComplete: boolean): ReviewCounter | null {
  const digits = text.match(LEFT_TO_COMPLETE_RE)?.[1];
  if (digits) return { left: parseInt(digits, 10), raw: text };
  if (allowComplete) {
    if (FINISHED_RE.test(text)) return { left: 0, raw: text };
    if (COMPLETE_COUNT_RE.test(text) && /review/i.test(text)) {
      return { left: 0, raw: text };
    }
  }
  return null;
}

/**
 * Read the review counter wherever the current UI renders it (the hub
 * AND /review-next both show it). Tier 1 is the prototype's §4.4
 * anchor [data-testid="review-count"]; tier 2 scans for the shortest
 * element whose text carries the counter — the visible text is the
 * stable contract confirmed live, the testid is not guaranteed.
 */
export function readReviewCounter(): ReviewCounter | null {
  const onHub = location.pathname.includes("/give-feedback");
  const anchor = document.querySelector('[data-testid="review-count"]');
  if (anchor) {
    const parsed = parseCounterText((anchor.textContent ?? "").trim(), onHub);
    if (parsed) {
      log.debug("review", "counter via [data-testid=review-count]", { ...parsed });
      return parsed;
    }
  }
  let best: { len: number; counter: ReviewCounter } | null = null;
  const candidates = document.querySelectorAll("div, span, p, h1, h2, h3, h4, li");
  for (const el of Array.from(candidates)) {
    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ");
    if (text.length === 0 || text.length > 90) continue;
    let parsed = parseCounterText(text, onHub);
    if (!parsed && onHub && COMPLETE_COUNT_RE.test(text)) {
      // Bare "N complete": only a counter when a Reviews label sits in
      // the same small container (the hub pairs the two).
      const around = (el.parentElement?.textContent ?? "").trim().replace(/\s+/g, " ");
      if (around.length <= 140 && /reviews/i.test(around)) {
        parsed = { left: 0, raw: text };
      }
    }
    if (parsed && (!best || text.length < best.len)) {
      best = { len: text.length, counter: parsed };
    }
  }
  if (best) log.debug("review", "counter via text scan", { ...best.counter });
  return best?.counter ?? null;
}

export type ReviewPageState =
  | { kind: "blocked" }
  | { kind: "hub"; counter: ReviewCounter | null }
  | { kind: "review"; counter: ReviewCounter | null }
  | { kind: "other" };

function hasReviewForm(): boolean {
  return (
    document.querySelector(
      '[role="radiogroup"], .peer-option-input, div[data-testid="peer-review-multi-line-input-field"]'
    ) !== null
  );
}

function findStartReviewing(): HTMLElement | null {
  return (
    findByText<HTMLElement>("button", "Start Reviewing") ??
    findByText<HTMLElement>("a", "Start Reviewing")
  );
}

/** Classify the page the action was started on (logged at flow start). */
export function inspectReviewPage(): ReviewPageState {
  const counter = readReviewCounter();
  if (location.pathname.includes("/give-feedback")) {
    const bodyText = (document.body?.textContent ?? "").toLowerCase();
    // Blocked = the banner is up AND there is no way to start (the
    // banner sentence alone could appear in ready-state instructions).
    if (bodyText.includes(BLOCKED_MARKER) && !findStartReviewing()) {
      return { kind: "blocked" };
    }
    return { kind: "hub", counter };
  }
  if (
    location.pathname.includes("/review-next") ||
    location.pathname.includes("/review/") ||
    hasReviewForm()
  ) {
    return { kind: "review", counter };
  }
  return { kind: "other" };
}

function scrollIntoViewSafe(el: HTMLElement): void {
  if (typeof el.scrollIntoView === "function") el.scrollIntoView();
}

/** Poll for the review form after the hub's SPA navigation. */
async function waitForReviewForm(timeoutMs: number): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (hasReviewForm()) return true;
    await sleep(250);
  }
  return hasReviewForm();
}

/** Identity of the displayed review form — its first rubric group. */
function formSignature(): Element | null {
  return document.querySelector('[role="radiogroup"], div[role="group"]');
}

/**
 * Wait until the conveyor advances after a submit: the counter drops
 * (or reaches 0), or the displayed form is replaced by a fresh,
 * unanswered one at the same URL.
 */
async function waitForNextReview(
  prev: { signature: Element | null; left: number },
  timeoutMs: number
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const counter = readReviewCounter();
    if (counter && counter.left < prev.left) return true;
    const sig = formSignature();
    if (sig && prev.signature && !prev.signature.isConnected) return true;
    if (
      sig &&
      sig !== prev.signature &&
      !sig.querySelector('input:checked, [aria-checked="true"]')
    ) {
      return true;
    }
    await sleep(500);
  }
  return false;
}

/**
 * Auto peer review (the panel's "Grading ..." action) — prototype `_D`
 * with the orchestration rewritten for the current UI (issue #38; see
 * the block comment above). The §4.1 guard and §4.5 gate are the
 * prototype's; Pd (gradeOnePeerItem) is the unchanged 1:1 port.
 */
export async function handleReview(): Promise<void> {
  log.info("review", "handleReview — start", { href: location.href });

  // §4.1 Guard: location.pathname (note: pathname, not href) + alert.
  if (!location.pathname.includes("/learn/")) {
    const msg = "This is not a course page, please go to your course page first";
    log.error("review", "guard failed — not /learn/", { href: location.href });
    alert(msg);
    return;
  }

  // §4.5 Vendor gate (clone noop; position per dD/vD pattern).
  gate();

  const state = inspectReviewPage();
  const startCounter = "counter" in state ? state.counter : null;
  log.info("review", "page state", {
    kind: state.kind,
    left: startCounter?.left ?? null,
    href: location.href
  });

  if (state.kind === "blocked") {
    log.warn(
      "review",
      'hub blocked: "Submit your project before reviewing classmates" — submit your own assignment first, then run again'
    );
    return;
  }
  if (state.kind === "other") {
    log.warn(
      "review",
      "not a give-feedback hub or a review page — open the assignment's peer-review page and run again"
    );
    return;
  }

  if (state.kind === "hub") {
    if (state.counter?.left === 0) {
      log.info("review", "peer reviews already complete — nothing to do");
      return;
    }
    const startBtn = findStartReviewing();
    if (!startBtn) {
      log.warn("review", '"Start Reviewing" not found on the hub');
      return;
    }
    // The button sits at the page bottom (live evidence 2026-11-01).
    scrollIntoViewSafe(startBtn);
    await sleep(300);
    startBtn.click();
    log.info("review", 'clicked "Start Reviewing" — waiting for the review page');
    if (!(await waitForReviewForm(15000))) {
      log.warn(
        "review",
        'review form did not appear after "Start Reviewing" — if the page reloaded, run the action again on the review page'
      );
      return;
    }
  }

  // Conveyor loop. With no readable counter this is a legacy
  // single-review page: grade it once and stop (the prototype's two
  // loops used to grade such a page twice).
  const first = readReviewCounter();
  if (!first) {
    await gradeOnePeerItem();
    await sleep(2500); // let Pd's +700ms submit click land
    log.info("review", "no counter on this page — graded the single open review");
    log.info("review", "handleReview — done");
    return;
  }

  let rounds = 0;
  let staleRounds = 0;
  let current = first;
  const MAX_ROUNDS = 30; // hard safety cap; real hubs ask for ~4
  while (current.left > 0 && rounds < MAX_ROUNDS) {
    const signature = formSignature();
    log.info("review", `round ${rounds + 1}: ${current.left} left to complete`);
    await gradeOnePeerItem();
    rounds++;
    const moved = await waitForNextReview({ signature, left: current.left }, 25000);
    const next = readReviewCounter();
    if (!moved || !next) {
      log.warn("review", "no next review appeared after submitting — stopping", {
        left: next?.left ?? null
      });
      break;
    }
    if (next.left >= current.left) {
      staleRounds++;
      if (staleRounds >= 2) {
        log.warn("review", "counter is not decreasing — stopping", { left: next.left });
        break;
      }
    } else {
      staleRounds = 0;
    }
    current = next;
  }
  if (rounds >= MAX_ROUNDS) {
    log.warn("review", `safety cap of ${MAX_ROUNDS} rounds reached — stopping`);
  }
  log.info("review", `handleReview — done, graded ${rounds} review(s)`, {
    left: current.left
  });
}
