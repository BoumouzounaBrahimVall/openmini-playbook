import { mini } from "@openmini/runtime";
import { parseHits, searchUrl, type DayWindow, type Story } from "./feed.js";

const REQUEST_TIMEOUT_MS = 10_000;

export type FetchResult =
  | { ok: true; stories: readonly Story[] }
  | { ok: false; message: string };

/**
 * The only place the feed touches the bridge. A non-2xx status resolves
 * normally on `mini.request` (HTTP errors are data, not bridge errors), so
 * both paths end up as a `FetchResult` the UI can render as a Retry row.
 */
export async function fetchWindow(window: DayWindow): Promise<FetchResult> {
  try {
    const response = await mini.request({
      url: searchUrl(window),
      method: "GET",
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    if (response.status < 200 || response.status >= 300) {
      return {
        ok: false,
        message: `Hacker News answered ${String(response.status)}`,
      };
    }
    return { ok: true, stories: parseHits(response.body) };
  } catch (error: unknown) {
    console.error("technews: fetch failed", error);
    return { ok: false, message: "Couldn't reach Hacker News" };
  }
}
