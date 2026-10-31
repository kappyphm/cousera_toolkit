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
import { sleep, waitForSelector } from "../shared/coursera.ts";
import { createLogger } from "../shared/logger.ts";

const log = createLogger("auto-peer-review");

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
  return (
    Array.from(document.querySelectorAll<HTMLElement>("button")).find(
      (b) => (b.textContent ?? "").trim() === "Submit Review"
    ) ?? null
  );
}

/** 1:1 of `Pd` — grade one peer item on the review page. */
async function gradeOnePeerItem(): Promise<void> {
  log.info("Pd", "grade one peer item — start");

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
  log.info("Pd", `rubric groups n=${groups.length}`);
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
        log.debug("Pd", `spread=${spread} > 1 — pick last option`, { nums });
        x[x.length - 1]?.click();
      } else {
        log.debug("Pd", `spread=${spread} — pick first option`, { nums });
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
      log.debug("Pd", 'feedback textarea filled with "Good "');
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
      log.info("Pd", "submit clicked (+700ms, prototype timing)");
    } else {
      log.warn("Pd", "submit button not found at +700ms");
    }
  }, 700);

  log.info("Pd", "grade one peer item — done");
}

/** 1:1 of `_D` — auto peer review (the panel's "Grading ..." action). */
export async function handleReview(): Promise<void> {
  log.info("_D", "handleReview — start", { href: location.href });

  // §4.1 Guard: location.pathname (note: pathname, not href) + alert.
  if (!location.pathname.includes("/learn/")) {
    const msg = "This is not a course page, please go to your course page first";
    log.error("_D", "guard failed — not /learn/", { href: location.href });
    alert(msg);
    return;
  }

  // §4.5 Vendor gate (clone noop; position per dD/vD pattern).
  gate();

  // §4.2 Open course link — three se() clicks, errors ignored, with the
  // decoded sleep(1000) between the first and the rest. Fire-and-forget
  // .then(click).catch(()=>{}) exactly like the prototype.
  void waitForSelector<HTMLElement>('button[data-js="open-course-link"]', 1000)
    .then((r) => r.click())
    .catch(() => {});
  await sleep(1000);
  void waitForSelector<HTMLElement>('button[data-js="open-course-link"]', 1000)
    .then((r) => r.click())
    .catch(() => {});
  void waitForSelector<HTMLElement>(".css-2imjyh .css-7jkbgo a", 1000)
    .then((r) => r.click())
    .catch(() => {});

  // §4.3 /review/ page loop — max 5 rounds while the URL keeps changing.
  if (location.href.includes("/review/")) {
    let r = location.href;
    let i = 0;
    do {
      await gradeOnePeerItem();
      if (location.href !== r) {
        i++;
        r = location.href;
      } else break;
    } while (i < 5);
    log.info("_D", `/review/ loop ended after i=${i}`);
  }

  // §4.4 "Left to complete" loop — count text is read BEFORE each Pd(),
  // then Pd() + sleep(2000); loop while the text includes the marker.
  let t: string | undefined;
  do {
    t = await waitForSelector<HTMLElement>('[data-testid="review-count"]', 1000)
      .then((r) => r.innerText)
      .catch(() => undefined);
    await gradeOnePeerItem();
    await sleep(2000);
  } while (t != null && t.includes("left to complete"));

  log.info("_D", "handleReview — done");
}
