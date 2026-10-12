import { CloneError, createLogger } from "./logger.ts";

const log = createLogger("coursera-shared");

export interface CourseMaterials {
  data: MaterialItem[];
  courseId: string;
  slug: string;
}

export interface MaterialItem {
  id: string;
  name?: string;
  timeCommitment?: number;
  contentSummary?: { typeName?: string };
  [k: string]: unknown;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 1:1 of prototype `se` — poll querySelector, reject (never null) on timeout. */
export function waitForSelector<T extends Element = Element>(
  selector: string,
  timeoutMs = 5000
): Promise<T> {
  log.debug("waitForSelector", `waiting ${selector}`, { timeoutMs });
  const started = performance.now();
  return new Promise<T>((resolve, reject) => {
    const timer = window.setInterval(() => {
      const el = document.querySelector<T>(selector);
      if (el) {
        window.clearInterval(timer);
        window.clearTimeout(killer);
        log.debug("waitForSelector", `found ${selector}`, {
          ms: Math.round(performance.now() - started)
        });
        resolve(el);
      }
    }, 100);
    const killer = window.setTimeout(() => {
      window.clearInterval(timer);
      const err = new CloneError(`Element not found within ${timeoutMs}ms`, {
        module: "coursera-shared",
        step: "waitForSelector",
        ms: timeoutMs
      });
      log.error("waitForSelector", selector, { ms: timeoutMs });
      reject(err);
    }, timeoutMs);
  });
}

/**
 * 1:1 of prototype `c2` — slug from /learn/<slug>/, then course materials.
 * Throws on any unexpected shape (no silent fallback).
 */
export async function getCourseMaterials(): Promise<CourseMaterials> {
  const href = window.location.href;
  const slug = href.split("/")[4];
  if (!slug) {
    throw new CloneError("cannot parse slug from URL", {
      module: "coursera-shared",
      step: "getCourseMaterials",
      slug: href
    });
  }
  log.info("getCourseMaterials", `fetch materials slug=${slug}`, { slug });
  const started = performance.now();
  // Exact strings decoded from prototype Bn() (table ra, base 215):
  // Bn(218) + slug + Bn(227) — includes must contain `items` and fields must
  // request contentSummary, otherwise linked.onDemandCourseMaterialItems.v2
  // is absent and typeName filtering is impossible.
  const res = await fetch(
    "https://www.coursera.org/api/onDemandCourseMaterials.v2/?q=slug&slug=" +
      slug + // prototype: plain concat (Bn218 + t + Bn227), no encoding
      "&includes=modules%2Clessons%2CpassableItemGroups%2CpassableItemGroupChoices%2CpassableLessonElements%2Citems%2Ctracks%2CgradePolicy%2CgradingParameters%2CembeddedContentMapping&fields=moduleIds%2ConDemandCourseMaterialModules.v1(name%2Cslug%2Cdescription%2CtimeCommitment%2ClessonIds%2Coptional%2ClearningObjectives)%2ConDemandCourseMaterialLessons.v1(name%2Cslug%2CtimeCommitment%2CelementIds%2Coptional%2CtrackId)%2ConDemandCourseMaterialPassableItemGroups.v1(requiredPassedCount%2CpassableItemGroupChoiceIds%2CtrackId)%2ConDemandCourseMaterialPassableItemGroupChoices.v1(name%2Cdescription%2CitemIds)%2ConDemandCourseMaterialPassableLessonElements.v1(gradingWeight%2CisRequiredForPassing)%2ConDemandCourseMaterialItems.v2(name%2CoriginalName%2Cslug%2CtimeCommitment%2CcontentSummary%2CisLocked%2ClockableByItem%2CitemLockedReasonCode%2CtrackId%2ClockedStatus%2CitemLockSummary)%2ConDemandCourseMaterialTracks.v1(passablesCount)%2ConDemandGradingParameters.v1(gradedAssignmentGroups)%2CcontentAtomRelations.v1(embeddedContentSourceCourseId%2CsubContainerId)&showLockedItems=true"
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CloneError("course materials fetch failed", {
      module: "coursera-shared",
      step: "getCourseMaterials",
      slug,
      status: res.status,
      ms: Math.round(performance.now() - started),
      body: text.slice(0, 500)
    });
  }
  const body = (await res.json()) as {
    linked?: Record<string, Array<{ id: string }>>;
  };
  const linkedKeys = Object.keys(body?.linked ?? {});
  const data = body?.linked?.["onDemandCourseMaterialItems.v2"] as
    | MaterialItem[]
    | undefined;
  const courseId = body?.linked?.["onDemandCourseMaterialGradePolicy.v1"]?.[0]
    ?.id as string | undefined;
  if (!data || !courseId) {
    log.error("getCourseMaterials", "payload missing linked items", {
      slug,
      status: res.status,
      linkedKeys,
      hasItems: Boolean(data),
      hasCourseId: Boolean(courseId),
      bodyPreview: JSON.stringify(body).slice(0, 400)
    });
    throw new CloneError("course materials payload missing linked items", {
      module: "coursera-shared",
      step: "getCourseMaterials",
      slug,
      status: res.status,
      linkedKeys
    });
  }
  log.info("getCourseMaterials", `ok items=${data.length} courseId=${courseId}`, {
    slug,
    courseId,
    ms: Math.round(performance.now() - started)
  });
  return { data, courseId, slug };
}

/** 1:1 of prototype `jv`/`getUserId` source: storage first, else parse userJson. */
export async function getUserId(): Promise<string> {
  const cached = await chrome.storage.local.get("userId");
  if (cached?.userId) {
    log.debug("getUserId", "from storage", { userId: String(cached.userId) });
    return String(cached.userId);
  }
  log.info("getUserId", "storage miss, parsing userJson from page scripts");
  const scripts = Array.from(document.getElementsByTagName("script"));
  const hit = scripts.find((s) => s.innerText.includes("var userJson"));
  if (!hit) {
    throw new CloneError("userJson script not found", {
      module: "coursera-shared",
      step: "getUserId"
    });
  }
  const m = hit.innerText.match(/var userJson = "(.+)";/);
  if (!m?.[1]) {
    throw new CloneError("userJson match failed", {
      module: "coursera-shared",
      step: "getUserId"
    });
  }
  let parsed: { id: unknown; email?: string; email_address?: string };
  try {
    parsed = JSON.parse(m[1].replace(/\\"/g, '"')) as typeof parsed;
  } catch (e) {
    throw new CloneError(`userJson parse failed: ${(e as Error).message}`, {
      module: "coursera-shared",
      step: "getUserId"
    });
  }
  if (parsed.id == null || parsed.id === "") {
    throw new CloneError("userJson has no id", {
      module: "coursera-shared",
      step: "getUserId"
    });
  }
  await chrome.storage.local.set({ userId: parsed.id });
  const email = parsed.email_address ?? parsed.email;
  if (email) await chrome.storage.sync.set({ email });
  log.info("getUserId", `parsed id=${String(parsed.id)}`, {
    userId: String(parsed.id)
  });
  return String(parsed.id);
}

/** Raw CSRF3-Token cookie value (prototype `l`). */
export function csrfToken(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)CSRF3-Token\s*=\s*([^;]+)/);
  return m?.[1] ?? null;
}

/** 1:1 CSRF header builder from prototype `l(v)`. */
export function csrfHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const csrf = csrfToken();
  if (!csrf) log.warn("csrfHeaders", "CSRF3-Token cookie missing — requests may 403");
  return {
    "Content-Type": "application/json",
    ...(csrf ? { "X-CSRF3-Token": csrf } : {}),
    ...extra
  };
}

/** POST helper with mandatory ok-check + logging (no silent failure). */
export async function postJson<T = unknown>(
  module: string,
  step: string,
  url: string,
  body: unknown,
  headers: Record<string, string>,
  ctx: Record<string, unknown> = {}
): Promise<{ res: Response; json: T | null }> {
  const log2 = createLogger(module);
  const started = performance.now();
  log2.info(step, `POST ${url}`, ctx);
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    log2.error(step, `POST failed status=${res.status}`, {
      ...ctx,
      status: res.status,
      ms: Math.round(performance.now() - started),
      body: text.slice(0, 500)
    });
    throw new CloneError(`POST ${url} failed with ${res.status}`, {
      module,
      step,
      status: res.status,
      ...ctx
    });
  }
  // Prototype `u()` for CompletedItems (and siblings) ignores the response
  // body entirely — Coursera answers some POSTs with an HTML page (2xx).
  // Tolerate non-JSON body: log preview, return null, never throw on parse.
  const text = await res.text();
  let json: T | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as T;
    } catch {
      log2.info(step, `POST ok status=${res.status} non-JSON body (ignored like prototype)`, {
        ...ctx,
        status: res.status,
        ms: Math.round(performance.now() - started),
        bodyPreview: text.slice(0, 300)
      });
      return { res, json };
    }
  }
  log2.info(step, `POST ok status=${res.status}`, {
    ...ctx,
    status: res.status,
    ms: Math.round(performance.now() - started)
  });
  return { res, json };
}
