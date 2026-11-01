// Progress state store — the run state (title, status, steps) that
// feature flows report through progress.start/step/finish/fail and
// the side panel renders via the bridge in main.ts.
//
// This module used to also render a dark floating panel on the
// Coursera page itself; that overlay was removed on 2026-11-01 (user
// request) when the UI moved to chrome.sidePanel — the panel shows
// the same state, so an in-page duplicate is redundant. Nothing here
// touches the DOM anymore.

export type StepState = "active" | "done" | "error" | "info";

export interface ProgressStep {
  id: string;
  text: string;
  state: StepState;
}
export interface ProgressSnapshot {
  title: string;
  status: "idle" | "running" | "done" | "error";
  steps: ProgressStep[];
}
let snapshot: ProgressSnapshot = { title: "", status: "idle", steps: [] };
const progressSubscribers = new Set<(s: ProgressSnapshot) => void>();

/** Subscribe to snapshot changes; fires immediately with the current one. */
export function subscribeProgress(fn: (s: ProgressSnapshot) => void): () => void {
  progressSubscribers.add(fn);
  fn(snapshot);
  return () => {
    progressSubscribers.delete(fn);
  };
}

function publishProgress(): void {
  for (const fn of progressSubscribers) {
    try {
      fn(snapshot);
    } catch {
      /* a broken subscriber must never break the run */
    }
  }
}

function recordStep(id: string, text: string, state: StepState): void {
  const existing = snapshot.steps.find((s) => s.id === id);
  if (existing) {
    existing.text = text;
    existing.state = state;
  } else {
    snapshot.steps.push({ id, text, state });
  }
  publishProgress();
}

export const progress = {
  /** Reset the run state and set its title. */
  start(title: string): void {
    snapshot = { title, status: "running", steps: [] };
    publishProgress();
  },
  step(id: string, text: string, state: StepState = "active"): void {
    recordStep(id, text, state);
  },
  finish(text: string): void {
    recordStep("finish", text, "done");
    snapshot = { ...snapshot, status: "done" };
    publishProgress();
  },
  fail(text: string): void {
    recordStep("fail", text, "error");
    snapshot = { ...snapshot, status: "error" };
    publishProgress();
  }
};
