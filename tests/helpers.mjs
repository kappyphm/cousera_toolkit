// Shared jsdom setup for the saved-page regression suite.
//
// Each test file runs in its own process (node --test), so installing
// the page's window/document/location as globals here is safe. The
// src/ modules under test read those globals at call time, exactly
// like in the browser content script.
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

export function createDom(html, url) {
  const dom = new JSDOM(html, { url });
  const { window } = dom;
  // jsdom has no innerText; the clone uses it pervasively. textContent
  // is an adequate stand-in for these saved pages.
  if (!("innerText" in window.HTMLElement.prototype)) {
    Object.defineProperty(window.HTMLElement.prototype, "innerText", {
      get() {
        return this.textContent;
      },
      configurable: true
    });
  }
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.location = window.location;
  return dom;
}

export function loadFixture(name, url) {
  return createDom(readFileSync(path.join(FIXTURES, name), "utf8"), url);
}

export const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
