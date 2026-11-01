// Full structured logger. Every processing step must log; errors must
// propagate with context — never swallow with empty catch / default [].
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  module: string;
  step: string;
  courseId?: string;
  itemId?: string;
  slug?: string;
  status?: number;
  ms?: number;
  [k: string]: unknown;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function activeLevel(): LogLevel {
  const v = (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_LOG_LEVEL as LogLevel | undefined;
  return v === "debug" || v === "info" || v === "warn" || v === "error"
    ? v
    : "info";
}

/** One emitted log line, for in-page UI subscribers (sidebar feed). */
export interface LogEvent {
  level: LogLevel;
  module: string;
  step: string;
  message: string;
  time: Date;
}

const logSubscribers = new Set<(e: LogEvent) => void>();

/** Subscribe to every emitted log line; returns the unsubscribe fn. */
export function subscribeLogs(fn: (e: LogEvent) => void): () => void {
  logSubscribers.add(fn);
  return () => {
    logSubscribers.delete(fn);
  };
}

function emit(level: LogLevel, ctx: LogContext, message: string) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[activeLevel()]) return;
  const line = `[${level}] ${ctx.module}.${ctx.step} ${message}`;
  if (level === "error") console.error(line, ctx);
  else if (level === "warn") console.warn(line, ctx);
  else if (level === "debug") console.debug(line, ctx);
  else console.info(line, ctx);
  if (logSubscribers.size > 0) {
    const event: LogEvent = {
      level,
      module: ctx.module,
      step: ctx.step,
      message,
      time: new Date()
    };
    for (const fn of logSubscribers) {
      try {
        fn(event);
      } catch {
        /* a broken UI subscriber must never break logging */
      }
    }
  }
}

export function createLogger(module: string) {
  return {
    debug: (step: string, message: string, ctx: Omit<LogContext, "module" | "step"> = {}) =>
      emit("debug", { module, step, ...ctx }, message),
    info: (step: string, message: string, ctx: Omit<LogContext, "module" | "step"> = {}) =>
      emit("info", { module, step, ...ctx }, message),
    warn: (step: string, message: string, ctx: Omit<LogContext, "module" | "step"> = {}) =>
      emit("warn", { module, step, ...ctx }, message),
    error: (step: string, message: string, ctx: Omit<LogContext, "module" | "step"> = {}) =>
      emit("error", { module, step, ...ctx }, message)
  };
}

export type Logger = ReturnType<typeof createLogger>;

/** Throw with structured context — the only allowed error path. */
export class CloneError extends Error {
  readonly ctx: LogContext;
  constructor(message: string, ctx: LogContext) {
    super(`${ctx.module}.${ctx.step}: ${message}`);
    this.name = "CloneError";
    this.ctx = ctx;
  }
}
