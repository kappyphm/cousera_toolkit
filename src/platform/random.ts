// 1:1 of prototype `Ut as generateRandomString` @ 355936.
// Draws random WORDS from the Vc dictionary (3702 entries, decoded from
// table Ds base 156 rotation 984277) — not random characters.
// The import attribute is inert for Vite/rolldown (the JSON is inlined
// as before) but lets Node's type-stripping load this module in the
// tests/ suite — without it, importing anything that transitively
// imports random.ts fails under plain Node (issue #32).
import WORDS from "./random-words.json" with { type: "json" };

const Vc: readonly string[] = WORDS;

/** Prototype `Ut(e=10, n=" ")` — e random words joined by n. */
export function generateRandomWords(count = 10, separator = " "): string {
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * Vc.length);
    parts.push(Vc[idx] as string);
  }
  return parts.join(separator);
}
