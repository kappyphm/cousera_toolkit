// 1:1 ports of DOM fill helpers used by mD (assignment submit) and Pd (review).
// hx @ 379425 (Slate.js/contenteditable), inline `i(el,text)` from mD @ 738051.
import { sleep } from "../shared/coursera.ts";
import { createLogger } from "../shared/logger.ts";

const log = createLogger("editor-fill");

/**
 * 1:1 of prototype `hx(el, text)` @ 379425 — Slate.js / contenteditable fill.
 * resolve target -> focus -> select-all range -> Backspace keydown + delete ->
 * InputEvent(insertText) + execCommand(insertHTML, \n -> <br>).
 * Prototype catch logs Vietnamese message and returns false — keep behavior
 * but route through logger.
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
    (target as HTMLElement).focus();
    await sleep(200);
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(target);
      sel.removeAllRanges();
      sel.addRange(range);
      await sleep(100);
      target.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Backspace", code: "Backspace", bubbles: true })
      );
      document.execCommand("delete", false, undefined);
    }
    await sleep(200);
    const ev = new InputEvent("insertText", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text
    });
    const dispatched = target.dispatchEvent(ev);
    if (dispatched) {
      document.execCommand("insertHTML", false, text.replace(/\n/g, "<br>"));
    }
    await sleep(150);
    await sleep(500);
    log.debug("fillEditor", `filled len=${text.length}`, { tag: target.tagName });
    return true;
  } catch (e) {
    // Prototype: console.error("Lỗi fill editor Slate.js:", e) — log via logger.
    log.error("fillEditor", "Lỗi fill editor Slate.js:", { error: (e as Error).message });
    return false;
  }
}

/**
 * 1:1 of the inline fill helper `i(el, text)` inside prototype `mD`.
 * click -> sleep200 -> focus -> sleep200 -> select? -> execCommand(insertText)
 * -> sleep200 -> set value -> dispatch change + input.
 */
export async function fillPlainInput(el: HTMLInputElement | HTMLTextAreaElement, text: string): Promise<void> {
  if (!el) return;
  el.click();
  await sleep(200);
  el.focus();
  await sleep(200);
  (el as HTMLInputElement).select?.();
  document.execCommand("insertText", false, text);
  await sleep(200);
  el.value = text;
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  log.debug("fillPlainInput", `filled len=${text.length}`, { tag: el.tagName });
}
