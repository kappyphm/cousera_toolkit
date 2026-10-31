// Auto-quiz — clone variant of prototype `x2 as handleAutoquiz` @ 705766.
// Origin: prototype/assets/chunk-674d105d.js, analysis/v3/01-ai-auto-quiz.md
//
// DELIBERATE VARIANT (user decision 2026-10-31): the prototype resolves
// answers from the vendor answer bank first (`cC` -> POST cosemira.com/quiz,
// AES-encrypted) and only sends unmatched questions to Gemini (`nD`), then
// uploads leftovers (`oD` -> /contribute1004). This clone has NO vendor
// server: every question goes to Gemini via the prototype's own `nD` path,
// and the upload step is dropped. Everything else follows the prototype:
// `px` normalization, `Qz` term building, `rD`/`u2` matching + fill,
// `Et` badges, and the Appendix A orchestration (isAutoSubmitQuiz flag,
// honor checkbox, submit/dialog loop) minus `oD`.
//
// Interpretation points (also in the GitHub issue):
//  1. The start-attempt primary-button selector (sn(357)) is not decoded
//     in analysis/v3/01 — START_ATTEMPT_SELECTOR below is a testid-pattern
//     fallback, same treatment as Pd's submit selector in v2/03.
//  2. rD's decoded matcher lowercases only the question side; both sides
//     are lowercased here so the two-way includes can actually hit, and
//     an exact term match (Gemini echoes Qz terms) is tried first.
//  3. `Yc` is reconstructed from the decoded essence in v3/01 §4.
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { sleep, waitForSelector } from "../shared/coursera.ts";
import { modelCandidates, parseGeminiError } from "../shared/gemini-error.ts";
import { DEFAULT_MODEL, withGeminiRetry } from "../shared/gemini.ts";
import { notifyUser } from "../shared/notify.ts";
import { CloneError, createLogger } from "../shared/logger.ts";
import { fillPlainInput } from "./editor-fill.ts";

const log = createLogger("auto-quiz");

const CONTAINER_SELECTOR = ".css-1hhf6i, .rc-FormPartsQuestion";
const QUESTION_SELECTOR = ".css-x3q7o9 > div:nth-child(2), .rc-CML";
const OPTION_SELECTOR = ".rc-Option";
const OPTION_TEXT_SELECTOR = "span:nth-child(2), .rc-CML";

/** Undecoded in v3/01 (sn(357)) — testid-pattern fallback, verify later. */
const START_ATTEMPT_SELECTOR =
  'button[data-testid="start-attempt-modal-primary-button"], button[data-testid="start-attempt-button"]';

/**
 * 1:1 of prototype `px as extendStringPrototype` — the decoded replacement
 * chain, as a local function instead of a String.prototype override.
 */
export function normalizeText(s: string): string {
  return s
    .replaceAll("\u00A0", "") // px step 1: strip NBSP
    .replace(/\s+/g, " ")
    .replaceAll("\n", " ")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("‘", "'")
    .replaceAll("’", "'")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("…", "...")
    .replaceAll("Gemini", "")
    .replaceAll("FPT", "")
    .trim();
}

/** Normalized question key of a container (rD's `g`, incl. image src). */
function questionKey(container: Element): string {
  const qEl = container.querySelector<HTMLElement>(QUESTION_SELECTOR);
  const img = container.querySelector<HTMLImageElement>("figure > img, img");
  const imgSrc = img?.src?.split("?")[0];
  return normalizeText((qEl?.innerText ?? "") + (imgSrc ? " " + imgSrc : "")).toLowerCase();
}

export interface QuizTerm {
  term: string;
  definition: string;
}

/** 1:1 of `Qz` — build one {term, definition:""} per question container. */
export function buildTerm(container: Element): QuizTerm {
  const firstInput = container.querySelector<HTMLInputElement>(
    `${OPTION_SELECTOR} input, input, textarea`
  );
  const inputType = firstInput?.type ?? "text";
  const qEl = container.querySelector<HTMLElement>(QUESTION_SELECTOR);
  const question = normalizeText(qEl?.innerText ?? "");
  const choices = Array.from(container.querySelectorAll<HTMLElement>(OPTION_SELECTOR)).map((c) => {
    const img = c.querySelector<HTMLImageElement>("img");
    return normalizeText(c.innerText ?? "") + (img?.src ? " " + img.src : "");
  });
  return { term: `${inputType}, ${question} |${choices.join("|")}`, definition: "" };
}

/**
 * System instruction `Yc` — reconstructed from the decoded essence in
 * analysis/v3/01 §4 (the doc summarizes the bundle's 9 rules).
 */
const YC_SYSTEM_INSTRUCTION = [
  'You are given a JSON array. Extract the correct answer from "term" (options separated by "|") into "definition".',
  "1. Return ONLY a raw JSON array.",
  '2. "definition" must be a VERBATIM copy of the chosen option.',
  "3. Preserve punctuation, trailing dots and brackets exactly.",
  '4. radio: exactly 1 answer; checkbox: join all correct options with "|"; text: give a concise answer.',
  '5. Escape " as \\" inside JSON strings.'
].join("\n");

const ANSWER_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      term: {
        type: "string",
        description: "Formatted string: 'radio, [Question] | [Choice 1] | ...'"
      },
      definition: { type: "string", description: "Correct content of the answer" }
    },
    required: ["term", "definition"]
  }
} as const;

/**
 * 1:1 structure of `nD` — ONE batched Gemini call for all questions
 * (responseMimeType + responseJsonSchema + Yc), with the prototype's
 * try/catch retry without thinkingConfig. Model resolution differs only
 * in the fallback: storage.model ?? DEFAULT_MODEL (the prototype falls
 * back to metadata.modelList[0]; the clone does not call vendor config).
 */
/**
 * Resolve the API key, then try models in candidate order — a model
 * whose DAILY quota is exhausted hands over to the next candidate
 * (quotas are per-model), everything else throws immediately.
 */
async function solveWithGemini(containers: Element[]): Promise<QuizTerm[] | null> {
  const stored = await chrome.storage.local.get(["geminiAPI", "model"]);
  const apiKey = stored?.geminiAPI as string | undefined;
  if (!apiKey) {
    // Message verbatim from the prototype bundle.
    throw new CloneError("Gemini API key is missing in storage.", {
      module: "auto-quiz",
      step: "nD.key"
    });
  }
  const primary = (stored?.model as string | undefined) ?? DEFAULT_MODEL;
  const candidates = modelCandidates(primary);
  let lastErr: unknown;
  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i] as string;
    try {
      return await solveWithModel(containers, apiKey, model);
    } catch (e) {
      lastErr = e;
      const info = parseGeminiError(e);
      if (!info.dailyQuota) throw e;
      const next = candidates[i + 1];
      if (next) {
        log.warn("nD", `model ${model} daily quota exhausted — falling back to ${next}`);
        notifyUser(`Model ${model} đã hết quota ngày — chuyển sang ${next}…`, "warn", 9000);
      }
    }
  }
  const info = parseGeminiError(lastErr);
  throw new CloneError(
    `Tất cả model đều đã hết quota ngày (đã thử: ${candidates.join(", ")}). ${info.summary}`,
    { module: "auto-quiz", step: "nD.models", models: candidates }
  );
}

/** One batched solve attempt against a single model (nD body). */
async function solveWithModel(
  containers: Element[],
  apiKey: string,
  model: string
): Promise<QuizTerm[] | null> {
  const terms = containers.map(buildTerm);
  log.info("nD", `solving ${terms.length} question(s) via Gemini`, { model });

  const ai = new GoogleGenAI({ apiKey });
  const contents = JSON.stringify(terms);
  let text: string;
  try {
    const res = await withGeminiRetry(
      "nD",
      () =>
        ai.models.generateContent({
          model,
          contents,
          config: {
            thinkingConfig: { includeThoughts: false, thinkingLevel: ThinkingLevel.MINIMAL },
            responseMimeType: "application/json",
            systemInstruction: YC_SYSTEM_INSTRUCTION,
            responseJsonSchema: ANSWER_SCHEMA
          }
        }),
      { silentDailyQuota: true }
    );
    text = res.text ?? "";
  } catch (e) {
    // A 429 already exhausted the retry layer — the prototype fallback
    // (retry without thinkingConfig) exists for config incompatibility,
    // not for quota; do not burn another call on a rate limit.
    if (parseGeminiError(e).status === 429) throw e;
    log.warn("nD", "call with thinkingConfig failed — retrying without it (prototype fallback)", {
      error: (e as Error).message
    });
    const res = await withGeminiRetry(
      "nD.noThinking",
      () =>
        ai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: "application/json",
            systemInstruction: YC_SYSTEM_INSTRUCTION,
            responseJsonSchema: ANSWER_SCHEMA
          }
        }),
      { silentDailyQuota: true }
    );
    text = res.text ?? "";
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text || "[]");
  } catch (e) {
    throw new CloneError(`Gemini answer JSON parse failed: ${(e as Error).message}`, {
      module: "auto-quiz",
      step: "nD.parse",
      preview: text.slice(0, 300)
    });
  }
  // Prototype: `if (answers?.error) return;`
  if (!Array.isArray(parsed) || (parsed as { error?: unknown })?.error) {
    log.error("nD", "Gemini returned an error payload — aborting fill", {
      preview: text.slice(0, 300)
    });
    return null;
  }
  const answers = parsed as QuizTerm[];
  log.info("nD", `received ${answers.length} answer(s)`, { model });
  return answers;
}

const BADGE_COLORS: Record<string, string> = {
  FPT: "#f54e00",
  ChatGPT: "#ffc107",
  Gemini: "#0263f5",
  DeepSeek: "#dc3545",
  OK: "#f54e00"
};

/** 1:1 of `Et as addBadgeToLabel` — colored source badge, deduped. */
export function addBadge(label: Element, source: string): void {
  if (label.closest(`.badge[data-text="${source}"]`)) return;
  const l = document.createElement("span");
  l.textContent = source;
  l.className = "badge font-bold";
  l.style.backgroundColor = BADGE_COLORS[source] ?? "#0263f5";
  l.setAttribute("data-text", source);
  label.appendChild(l);
}

/** Normalized option key (rD's `A`): visible text + image src. */
function optionKey(opt: Element): string {
  const txt = opt.querySelector<HTMLElement>(OPTION_TEXT_SELECTOR)?.innerText ?? "";
  const src = opt.querySelector<HTMLImageElement>("img")?.src ?? "";
  return normalizeText(txt + " " + src);
}

/**
 * Fill one container from a definition, rD/u2 style. Returns true when
 * at least one control was acted on.
 */
async function fillContainer(container: Element, definition: string, source: string): Promise<boolean> {
  const defN = normalizeText(definition);
  let acted = false;

  const options = Array.from(container.querySelectorAll(OPTION_SELECTOR));
  if (options.length > 0) {
    // Checkbox answers arrive as "a|b|c" (Yc rule 4) — click each part.
    const parts = defN.split("|").map((p) => normalizeText(p)).filter(Boolean);
    for (const opt of options) {
      const input = opt.querySelector<HTMLInputElement>("input");
      if (!input) continue;
      const A = optionKey(opt);
      if (A.length === 0) continue;
      if (input.type === "radio") {
        if (defN.includes(A) || A.includes(defN)) {
          input.click();
          addBadge(input, source);
          acted = true;
        }
      } else if (input.type === "checkbox") {
        if (parts.some((p) => p.includes(A) || A.includes(p)) && A.length > 0) {
          input.click();
          addBadge(input, source);
          acted = true;
        }
      } else if (input.type === "text") {
        input.click();
        await fillPlainInput(input, definition);
        addBadge(input, source);
        acted = true;
      }
    }
    return acted;
  }

  // No options: standalone text input / textarea / editor (u2 variants).
  const textInput = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    'input[type="text"], input:not([type]), textarea'
  );
  if (textInput) {
    textInput.click();
    await fillPlainInput(textInput, definition);
    addBadge(textInput, source);
    return true;
  }
  return false;
}

/**
 * rD/u2 fill across containers. Matching: exact normalized term first
 * (Gemini echoes the Qz term), else the prototype's two-way includes on
 * the normalized question. Returns the containers that stayed unfilled
 * (prototype rD returns `unmatched`).
 */
async function fillAnswers(
  containers: Element[],
  answers: QuizTerm[],
  source: string
): Promise<Element[]> {
  const unmatched: Element[] = [];
  const builtTerms = containers.map((c) => normalizeText(buildTerm(c).term));
  for (let i = 0; i < containers.length; i++) {
    const container = containers[i] as Element;
    const g = questionKey(container);
    const ans =
      answers.find((a) => normalizeText(a.term) === builtTerms[i]) ??
      answers.find((a) => {
        const t = normalizeText(a.term).toLowerCase();
        return t.includes(g) || g.includes(t);
      });
    if (!ans || !ans.definition) {
      unmatched.push(container);
      continue;
    }
    const ok = await fillContainer(container, ans.definition, source);
    if (!ok) unmatched.push(container);
  }
  log.info("fill", `filled ${containers.length - unmatched.length}/${containers.length}`, {
    unmatched: unmatched.length
  });
  return unmatched;
}

/** 1:1 orchestration of `x2` (Appendix A), minus cC bank and oD upload. */
export async function handleAutoquiz(): Promise<void> {
  log.info("x2", "Processing quiz... — start", { href: location.href });
  const { isAutoSubmitQuiz: flag } = await chrome.storage.local.get("isAutoSubmitQuiz");
  const autoSubmit = (flag as boolean | undefined) ?? false;

  // Not on /attempt -> start-attempt path (prototype waits up to 1 hour
  // for the cover button, then clicks the start modal until the
  // tunnel-vision overlay appears).
  if (!location.href.includes("/attempt")) {
    await waitForSelector<HTMLElement>('button[data-testid="CoverPageActionButton"]', 3_600_000)
      .then((btn) => btn.click())
      .catch(() => {});
    let overlay = document.querySelector('[data-testid="tunnel-vision-content"]');
    for (; !overlay;) {
      await sleep(1000);
      await waitForSelector<HTMLElement>(START_ATTEMPT_SELECTOR, 1000)
        .then((btn) => btn.click())
        .catch(() => {});
      overlay = document.querySelector('[data-testid="tunnel-vision-content"]');
    }
  }
  if (location.href.includes("/view-feedback")) {
    log.info("x2", "on /view-feedback — nothing to do (prototype returns)");
    return;
  }

  await waitForSelector(CONTAINER_SELECTOR, 20_000).catch(() => {});
  document
    .querySelector('button[aria-label="Back"]')
    ?.addEventListener("click", () => window.history.back());
  await waitForSelector(
    '.rc-CodeBlock, .icon-container, [data-testid="action-feedback-icon-container"]',
    2000
  )
    .then(async () => {
      await sleep(5000);
    })
    .catch(() => {});

  const containers = Array.from(document.querySelectorAll(CONTAINER_SELECTOR));
  log.info("x2", `question containers n=${containers.length}`);
  if (containers.length === 0) {
    log.error("x2", "no question containers found — aborting");
    return;
  }

  const answers = await solveWithGemini(containers);
  if (!answers) return; // error payload — prototype bails before fill
  const unmatched = await fillAnswers(containers, answers, "Gemini");

  // Honor code + settle (prototype order).
  await waitForSelector<HTMLElement>("#agreement-checkbox-base", 6000)
    .then((el) => el.click())
    .catch(() => {});
  await sleep(2000);

  if (!autoSubmit) {
    log.info(
      "x2",
      "Quiz filled! Auto-submit is OFF (isAutoSubmitQuiz) — review, then submit manually."
    );
    return;
  }

  // Auto-submit chain (prototype, flag on).
  await waitForSelector<HTMLInputElement>('[data-testid="input-area"] input', 2000)
    .then((el) => {
      el.click();
      el.dispatchEvent(new Event("input", { bubbles: true }));
    })
    .catch(() => {});
  // Confirm dialog loop — prototype checks .cds-Dialog-dialog first,
  // then re-checks .cds-Modal-container inside the loop (kept verbatim);
  // it has no iteration cap, so log every round.
  let dialog = document.querySelector(".cds-Dialog-dialog");
  for (let round = 1; !dialog; round++) {
    log.info("x2.submit", `waiting for confirm dialog, round ${round}`);
    await waitForSelector<HTMLElement>(
      'button[data-testid="submit-button"], button[data-test="submit-button"]',
      10_000
    )
      .then((el) => el.click())
      .catch(() => {});
    await sleep(1000);
    dialog = document.querySelector(".cds-Modal-container");
  }
  await waitForSelector<HTMLElement>('button[data-testid="dialog-submit-button"]', 10_000)
    .then((el) => el.click())
    .catch(() => {});

  // Prototype: `if (!filled || filled.length == 0) return;` — `filled`
  // is rD's unmatched list; nothing unmatched -> nothing more to do.
  if (unmatched.length === 0) {
    log.info("x2", "Quiz completed! All questions answered by Gemini.");
    return;
  }
  let tv = document.querySelector('[data-testid="tunnel-vision-content"]');
  for (; tv;) {
    await sleep(1000);
    tv = document.querySelector('[data-testid="tunnel-vision-content"]');
  }
  await sleep(2000);
  await waitForSelector<HTMLElement>('button[data-testid="view-feedback-button"]');
  document.querySelector<HTMLElement>('button[data-testid="view-feedback-button"]')?.click();
  // Prototype ends with oD(...) uploading unmatched questions to the
  // vendor server — dropped in this variant (no vendor server).
  log.info("x2", "Quiz completed! (oD upload skipped — clone has no vendor server)", {
    unmatched: unmatched.length
  });
}
