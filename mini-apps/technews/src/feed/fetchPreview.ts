import { mini } from "@openmini/runtime";
import { parsePreview, readerUrl, type Preview } from "./preview.js";

const REQUEST_TIMEOUT_MS = 12_000;

/**
 * Reader returns the page's metadata as JSON. The target selector limits the
 * extracted body to the title element, which shrinks the answer from tens of
 * kilobytes to about two while leaving the description and images intact.
 */
const READER_HEADERS: Readonly<Record<string, string>> = {
  Accept: "application/json",
  "X-Return-Format": "text",
  "X-Target-Selector": "title",
};

/** Null covers every failure: the row simply shows no preview. */
export async function fetchPreview(articleUrl: string): Promise<Preview | null> {
  try {
    const response = await mini.request({
      url: readerUrl(articleUrl),
      method: "GET",
      headers: { ...READER_HEADERS },
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    if (response.status < 200 || response.status >= 300) return null;
    return parsePreview(response.body);
  } catch (error: unknown) {
    console.error("technews: preview failed", error);
    return null;
  }
}
