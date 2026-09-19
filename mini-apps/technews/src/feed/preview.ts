/**
 * Article previews: a description and a social image for a story, fetched on
 * demand from Jina Reader, the one third-party origin in `allowedDomains`.
 * The API is keyless and rate-limited to 20 requests a minute per address,
 * which is why previews load per tap and never for a whole window.
 */

const READER_ORIGIN = "https://r.jina.ai";
const HN_ITEM_ORIGIN = "https://news.ycombinator.com";
/**
 * Images go through one allow-listed proxy: the packaged page's CSP only lets
 * `<img>` load from `allowedDomains`, and articles come from everywhere.
 */
const IMAGE_PROXY_ORIGIN = "https://wsrv.nl";
const IMAGE_WIDTH = 800;
/** Characters of page text shown when the page has no description. */
export const EXCERPT_LENGTH = 280;

export interface Preview {
  description: string | null;
  /** The start of the page text, for pages without a description. */
  excerpt: string | null;
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
    excerpt: excerptOf(nonEmpty(record.text) ?? nonEmpty(record.content)),
    image: httpsUrl(metadata["og:image"]) ?? httpsUrl(metadata["twitter:image"]),
  };
}

/** Resized and re-encoded by the proxy, so a 4 MB hero costs a few kilobytes. */
export function imageUrl(original: string): string {
  const params = new URLSearchParams({
    url: original,
    w: String(IMAGE_WIDTH),
    output: "webp",
  });
  return `${IMAGE_PROXY_ORIGIN}/?${params.toString()}`;
}

/** Whitespace collapsed, cut at the last word boundary before the limit. */
function excerptOf(text: string | null): string | null {
  if (text === null) return null;
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length === 0) return null;
  if (flat.length <= EXCERPT_LENGTH) return flat;
  const head = flat.slice(0, EXCERPT_LENGTH);
  const cut = head.lastIndexOf(" ");
  return `${(cut > 0 ? head.slice(0, cut) : head).trimEnd()}…`;
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
