// DOM fill helpers used by mD (assignment submit), Pd (review) and the
// AI text-fill flow.
// - fillEditor: Slate.js / contenteditable. Slate keeps its own value, so a
//   synthetic `insertText` InputEvent + execCommand only mutates the DOM
//   (visible text) without updating Slate state -> app sees an empty answer
//   and gates Submit disabled. Fix: drive insertion through `beforeinput`,
//   which Slate-react handles in onBeforeInput and commits to its value.
//   execCommand stays as fallback for plain contenteditables. Every fill ends
//   with a read-back verify — never report success on an empty editor.
// - fillPlainInput: inline `i(el,text)` from prototype mD @ 738051, fixed with
//   the native value-setter hack so React controlled inputs actually fire
//   onChange (direct `el.value=` assignment + synthetic event is ignored by
//   React's value tracker -> empty payload on submit).
import { sleep } from "../shared/coursera.ts";
import { createLogger } from "../shared/logger.ts";

const log = createLogger("editor-fill");

function beforeInput(
  target: Element,
  inputType: string,
  data: string | null
): void {
  target.dispatchEvent(
    new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType,
      data
    })
  );
}

/**
 * Slate-aware fill: resolve target -> focus -> select-all + clear ->
 * insert paragraph-by-paragraph via `beforeinput` (Slate commits it to its
 * value) -> fallback execCommand for non-Slate editables -> read-back verify.
 */
export async function fillEditor(el: Element, text: string): Promise<boolean> {
  try {
    let target: Element | null = el;
    if ((el as HTMLElement).getAttribute("contenteditable") !== "true") {
      target =
        el.querySelector('[contenteditable="true"]') ??
        el.querySelector('[data-slate-node="value"]') ??
        el.querySelector(".rc-CMLEditor");
    }
    if (!target) {
      log.error("fillEditor", "no contenteditable target found", {
        tag: el.tagName,
        className: (el as HTMLElement).className
      });
      return false;
    }
    const tgt = target as HTMLElement;
    const isSlate = tgt.querySelector("[data-slate-editor]") !== null ||
      tgt.hasAttribute("data-slate-editor");
    tgt.focus();
    await sleep(200);
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(tgt);
      sel.removeAllRanges();
      sel.addRange(range);
      await sleep(100);
      tgt.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Backspace", code: "Backspace", bubbles: true })
      );
      document.execCommand("delete", false, undefined);
    }
    await sleep(200);

    // Primary path: beforeinput per paragraph (Slate onBeforeInput commits).
    const paras = text.split("\n");
    for (let i = 0; i < paras.length; i++) {
      const para = paras[i];
      if (para) {
        beforeInput(tgt, "insertText", para);
        await sleep(80);
      }
      if (i < paras.length - 1) {
        beforeInput(tgt, "insertParagraph", null);
        await sleep(80);
      }
    }
    await sleep(400);

    let got = (tgt.innerText ?? "").trim().length;
    if (got === 0) {
      // Fallback for plain contenteditables (no Slate to consume beforeinput).
      log.warn("fillEditor", "beforeinput registered nothing — execCommand fallback", {
        isSlate,
        tag: tgt.tagName
      });
      tgt.focus();
      await sleep(200);
      document.execCommand("insertText", false, text);
      await sleep(200);
      if ((tgt.innerText ?? "").trim().length === 0) {
        document.execCommand("insertHTML", false, text.replace(/\n/g, "<br>"));
        await sleep(400);
      }
      got = (tgt.innerText ?? "").trim().length;
    }

    const expect = text.trim().length;
    log.info("fillEditor", `verify innerText=${got} expect~${expect}`, {
      tag: tgt.tagName,
      isSlate
    });
    if (got === 0) {
      log.error("fillEditor", "fill registered nothing — aborting", { expect });
      return false;
    }
    if (got < expect * 0.5) {
      log.warn("fillEditor", "partial fill suspected (user: review before submit)", {
        got,
        expect
      });
    }
    return true;
  } catch (e) {
    log.error("fillEditor", "fill editor failed:", { error: (e as Error).message });
    return false;
  }
}

/**
 * 1:1 intent of the inline fill helper `i(el, text)` inside prototype `mD`,
 * fixed for React: assign via the NATIVE value setter (bypasses React's
 * instance override so its tracker still holds the old value), then dispatch
 * a bubbled `input` event so React detects a real change and runs onChange.
 * Ends with read-back verify.
 */
export async function fillPlainInput(
  el: HTMLInputElement | HTMLTextAreaElement,
  text: string
): Promise<void> {
  if (!el) return;
  el.click();
  await sleep(200);
  el.focus();
  await sleep(200);
  (el as HTMLInputElement).select?.();
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) {
    setter.call(el, text);
  } else {
    el.value = text;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  await sleep(200);
  const got = el.value.length;
  log.info("fillPlainInput", `verify value=${got} expect=${text.length}`, {
    tag: el.tagName
  });
  if (got === 0) {
    log.error("fillPlainInput", "value read-back empty — React state likely not synced", {
      tag: el.tagName
    });
  }
}
