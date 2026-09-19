import { mini } from "@openmini/runtime";
import { parsePreview, readerUrl, type Preview } from "./preview.js";

const REQUEST_TIMEOUT_MS = 12_000;

/**
 * Reader returns the page's metadata and its readable text as JSON. The text
 * is what the excerpt comes from when a page has no description, which most
 * blog posts do not, so the body is worth its few tens of kilobytes per tap.
 */
const READER_HEADERS: Readonly<Record<string, string>> = {
  Accept: "application/json",
  "X-Return-Format": "text",
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
