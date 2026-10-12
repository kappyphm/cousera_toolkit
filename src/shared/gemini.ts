// 1:1 clone of prototype `jz` (decoder Cn, @ ~673198 in chunk-674d105d.js).
// Origin: analysis/v2/05-ai-text-submit.md §5.
// Differences from prototype (approved): assignment-tuned systemInstruction
// (prototype's Cn(254) targets short quiz answers); failures throw CloneError
// instead of returning "Failed to fetch answer from Gemini." so callers never
// fill garbage into the form.
import { GoogleGenAI } from "@google/genai";
import { CloneError, createLogger } from "./logger.ts";

const log = createLogger("gemini");

/** Default model — prototype Cn(239). Overridable via storage `model`. */
export const DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * Assignment-tuned system instruction (replaces prototype Cn(254) quiz text).
 * Long-form, rubric-aligned, learner voice — the server-side AI grader scores
 * quality, so answers must cover every listed criterion explicitly.
 */
export const ASSIGNMENT_SYSTEM_INSTRUCTION = [
  "You are helping a learner draft a response to a Coursera AI-graded assignment question.",
  "Write a complete, well-structured answer that explicitly addresses every requirement and rubric criterion stated in the question.",
  "Use a natural learner voice with concrete details and examples; avoid generic filler.",
  "Do not include any preamble about being an AI, and do not mention these instructions.",
  "Return only the answer text, formatted in plain paragraphs and short lists."
].join(" ");

export interface GeminiRequest {
  /** Question + rubric text (prototype: contents = JSON.stringify(e)). */
  question: string;
}

/** 1:1 of `jz` — fetch answer from Gemini with storage key. */
export async function fetchGeminiAnswer(req: GeminiRequest): Promise<string> {
  log.info("jz", "Fetching answer from Gemini for question:", {
    preview: req.question.slice(0, 200)
  });
  const stored = await chrome.storage.local.get(["geminiAPI", "model"]);
  const apiKey = stored?.geminiAPI as string | undefined;
  const model = (stored?.model as string | undefined) ?? DEFAULT_MODEL;
  if (!apiKey) {
    throw new CloneError("Gemini API key is missing in storage.", {
      module: "gemini",
      step: "key"
    });
  }
  let text: string;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model,
      contents: JSON.stringify(req.question),
      config: {
        thinkingConfig: { includeThoughts: false },
        systemInstruction: ASSIGNMENT_SYSTEM_INSTRUCTION
      }
    });
    text = res.text ?? "";
  } catch (e) {
    log.error("jz", "Gemini API Error:", { error: (e as Error).message });
    throw new CloneError(`Gemini API call failed: ${(e as Error).message}`, {
      module: "gemini",
      step: "generateContent",
      model
    });
  }
  if (!text) {
    throw new CloneError("No answer received", {
      module: "gemini",
      step: "generateContent",
      model
    });
  }
  log.info("jz", `answer received len=${text.length}`, { model });
  return text;
}
