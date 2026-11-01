// Tiered element lookup (issue #32).
//
// Selectors are tried in STABILITY order — data-testid first, then
// semantic/role anchors, then legacy rc-*/hash classes last — because
// Coursera rebuilds wipe hashed classes while testids survive (the
// peer-review breakage in issue #28 was four hash-class selectors
// dying at once). Every hit logs its tier at debug level, so the next
// time the UI shifts, the sidebar/console log shows exactly which
// tier matched — or that none did.
import { createLogger } from "./logger.ts";

const log = createLogger("finder");

/** First element matching the first selector (in order) that hits. */
export function findFirst<T extends Element = HTMLElement>(
  selectors: readonly string[],
  root: ParentNode = document
): T | null {
  for (let i = 0; i < selectors.length; i++) {
    const el = root.querySelector<T>(selectors[i] as string);
    if (el) {
      log.debug("findFirst", `tier ${i} matched: ${selectors[i]}`, { tier: i });
      return el;
    }
  }
  log.debug("findFirst", "no tier matched", { selectors });
  return null;
}

/** All elements from the first selector (in order) that hits at all. */
export function findAllFirst<T extends Element = HTMLElement>(
  selectors: readonly string[],
  root: ParentNode = document
): T[] {
  for (let i = 0; i < selectors.length; i++) {
    const els = Array.from(root.querySelectorAll<T>(selectors[i] as string));
    if (els.length > 0) {
      log.debug("findAllFirst", `tier ${i} matched n=${els.length}: ${selectors[i]}`, {
        tier: i,
        count: els.length
      });
      return els;
    }
  }
  log.debug("findAllFirst", "no tier matched", { selectors });
  return [];
}

/**
 * Find an element by its exact visible label — the fallback of last
 * resort for CDS buttons that expose no testid/aria-label (the review
 * page's "Submit Review" button, issue #28).
 */
export function findByText<T extends Element = HTMLElement>(
  tag: string,
  exactText: string,
  root: ParentNode = document
): T | null {
  const el = Array.from(root.querySelectorAll<T>(tag)).find(
    (b) => (b.textContent ?? "").trim() === exactText
  );
  log.debug("findByText", `${tag} "${exactText}" -> ${el ? "found" : "not found"}`);
  return el ?? null;
}
