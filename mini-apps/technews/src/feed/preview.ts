/**
 * Article previews: a description and a social image for a story, fetched on
 * demand from Jina Reader, the one third-party origin in `allowedDomains`.
 * The API is keyless and rate-limited to 20 requests a minute per address,
 * which is why previews load per tap and never for a whole window.
 */

const READER_ORIGIN = "https://r.jina.ai";
const HN_ITEM_ORIGIN = "https://news.ycombinator.com";

export interface Preview {
  description: string | null;
  /** https only; anything else reads as no image. */
  image: string | null;
}

/** Reader takes the target URL verbatim as its path. */
export function readerUrl(articleUrl: string): string {
  return `${READER_ORIGIN}/${articleUrl}`;
}

/** The discussion page, which every story has even when `url` is absent. */
export function hnItemUrl(storyId: string): string {
  return `${HN_ITEM_ORIGIN}/item?id=${encodeURIComponent(storyId)}`;
}

/** The response body is untrusted input. Null means "no preview", not an error. */
export function parsePreview(body: string): Preview | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { data } = parsed as { data?: unknown };
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  const metadata =
    typeof record.metadata === "object" && record.metadata !== null
      ? (record.metadata as Record<string, unknown>)
      : {};
  return {
    description: nonEmpty(record.description),
    image: httpsUrl(metadata["og:image"]) ?? httpsUrl(metadata["twitter:image"]),
  };
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}
