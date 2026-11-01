// Wire protocol between the side panel, the background switchboard
// and the content scripts (issue #34). Everything crossing a context
// boundary must stay structured-clone friendly: no Date objects (ISO
// strings instead), no functions, no class instances.
import type { ProgressSnapshot } from "../content/progress-ui.ts";
import type { LogLevel } from "./logger.ts";

/** One log line, serialized from the logger's LogEvent. */
export interface LogWire {
  kind: "log";
  level: LogLevel;
  module: string;
  step: string;
  message: string;
  /** ISO-8601 timestamp. */
  time: string;
}

/** A progress snapshot from progress-ui's state store. */
export interface ProgressWire {
  kind: "progress";
  snapshot: ProgressSnapshot;
}

export type ToolkitEvent = LogWire | ProgressWire;

/** The relayed run finished (or could not be started) in the tab. */
export interface RunDone {
  kind: "run-done";
  action: string;
  ok: boolean;
  error?: string;
}

/** Everything the background may post to the panel's port. */
export type BgToPanel = ToolkitEvent | RunDone;

/** The one command the panel sends: run an action in the active tab. */
export interface PanelRunCommand {
  type: "run";
  action: string;
}

export type PanelToBg = PanelRunCommand;

/** Envelope for content -> background runtime messages. */
export interface ToolkitEventEnvelope {
  kind: "toolkit-event";
  event: ToolkitEvent;
}
