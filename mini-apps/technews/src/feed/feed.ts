/**
 * The pure core of the digest: day windows, the Algolia query, the hit parser,
 * keyword matching and the ranking formula. Nothing here imports React or the
 * bridge, so all of it is exercised from `feed.test.ts` with plain values.
 *
 * "Intelligent" in this app means the formula in `score`. There is no LLM: an
 * API key cannot be protected inside a distributed `.mpkg`.
 */

export const DAY_SECONDS = 86_400;
/** Today plus six days back. */
export const WINDOW_COUNT = 7;
/** Multiplier per matched keyword on top of the crowd signal. */
export const KEYWORD_BOOST = 1.5;
/** A story at the oldest edge of its window keeps this share of its score. */
export const RECENCY_FLOOR = 0.7;

const ALGOLIA_ORIGIN = "https://hn.algolia.com";
const SEARCH_PATH = "/api/v1/search_by_date";
const HITS_PER_PAGE = 100;

export interface Story {
  id: string;
  title: string;
  /** Absent on Ask HN and other text posts. */
  url: string | null;
  points: number;
  comments: number;
  /** Unix seconds. */
  createdAt: number;
  author: string;
  /** Body of an Ask HN or other text post, as plain text. Null for links. */
  text: string | null;
}

/** One rolling 24h slice, `[start, end)` in unix seconds. */
export interface DayWindow {
  daysAgo: number;
  start: number;
  end: number;
}

export interface Feed {
  highlight: Story | null;
  /** Keyword matches, best first. Empty when there are no keywords. */
  forYou: readonly Story[];
  /** Everything else, best first. */
  rest: readonly Story[];
}

/**
 * Rolling rather than calendar days: at 8am a calendar window holds only
 * unvoted overnight noise, while the last 24h always has stories that have
 * had time to gather points. The anchor is taken once at launch so stepping
 * between chips is stable.
 */
export function windowFor(daysAgo: number, anchor: number): DayWindow {
  const end = anchor - daysAgo * DAY_SECONDS;
  return { daysAgo, start: end - DAY_SECONDS, end };
}

export function dayWindows(anchor: number): readonly DayWindow[] {
  return Array.from({ length: WINDOW_COUNT }, (_, daysAgo) =>
    windowFor(daysAgo, anchor),
  );
}

export function windowLabel(daysAgo: number): string {
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return `${String(daysAgo)}d`;
}

/**
 * `URLSearchParams` does the encoding on purpose: the API answers 400 to a
 * raw `>=` in the numeric filter.
 */
export function searchUrl(window: DayWindow): string {
  const params = new URLSearchParams({
    tags: "story",
    hitsPerPage: String(HITS_PER_PAGE),
    numericFilters: `created_at_i>=${String(window.start)},created_at_i<${String(window.end)}`,
  });
  return `${ALGOLIA_ORIGIN}${SEARCH_PATH}?${params.toString()}`;
}

/** The response body is untrusted input; anything unprovable is dropped. */
export function parseHits(body: string): readonly Story[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null) return [];
  const { hits } = parsed as { hits?: unknown };
  if (!Array.isArray(hits)) return [];
  return hits.flatMap((hit: unknown) => {
    const story = parseHit(hit);
    return story === null ? [] : [story];
  });
}

function parseHit(hit: unknown): Story | null {
  if (typeof hit !== "object" || hit === null) return null;
  const record = hit as Record<string, unknown>;
  const { objectID, title, url, created_at_i, author } = record;
  if (typeof objectID !== "string" || typeof title !== "string") return null;
  if (typeof created_at_i !== "number") return null;
  return {
    id: objectID,
    title,
    url: typeof url === "string" ? url : null,
    points: countOrZero(record.points),
    comments: countOrZero(record.num_comments),
    createdAt: created_at_i,
    author: typeof author === "string" ? author : "",
    text: htmlToText(record.story_text),
  };
}

const ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
  "&#x2F;": "/",
  "&nbsp;": " ",
};

/**
 * HN serves post bodies as a small HTML subset: `<p>`, `<a>`, `<i>`, `<pre>`
 * and a handful of entities. Tags become spaces, entities their characters.
 * Null when nothing readable is left, so callers can treat it like `url`.
 */
export function htmlToText(html: unknown): string | null {
  if (typeof html !== "string") return null;
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[#a-zA-Z0-9]+;/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
  return text.length === 0 ? null : text;
}

function countOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

/**
 * Number of keywords found as whole words in the title or the url hostname.
 * Substring matching is wrong here: `ai` would hit "said", "chain", "detail".
 * Lookarounds instead of `\b` so a keyword ending in a symbol (`c++`) still
 * gets a boundary.
 */
export function matchKeywords(
  title: string,
  url: string | null,
  keywords: readonly string[],
): number {
  return matchedKeywords(title, url, keywords).length;
}

/** The keywords found, in the order the list gives them. */
export function matchedKeywords(
  title: string,
  url: string | null,
  keywords: readonly string[],
): readonly string[] {
  if (keywords.length === 0) return [];
  const haystack = `${title} ${hostnameOf(url)}`;
  return keywords.filter((keyword) => wordPattern(keyword).test(haystack));
}

function hostnameOf(url: string | null): string {
  if (url === null) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function wordPattern(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
}

/**
 * crowd signal * personal relevance * recency.
 * The log keeps a 900-point launch from drowning everything; the boost lets a
 * 30-point story on a topic you follow beat a 100-point story you do not; the
 * decay only breaks ties in favour of the fresher story.
 */
export function score(
  story: Story,
  keywords: readonly string[],
  window: DayWindow,
): number {
  const crowd = Math.log10(story.points + 2 * story.comments + 1);
  const relevance =
    1 + KEYWORD_BOOST * matchKeywords(story.title, story.url, keywords);
  return crowd * relevance * recencyDecay(story.createdAt, window);
}

function recencyDecay(createdAt: number, window: DayWindow): number {
  const age = Math.min(Math.max(window.end - createdAt, 0), DAY_SECONDS);
  return 1 - (1 - RECENCY_FLOOR) * (age / DAY_SECONDS);
}

export function rankFeed(
  stories: readonly Story[],
  keywords: readonly string[],
  window: DayWindow,
): Feed {
  const ranked = stories
    .map((story) => ({ story, score: score(story, keywords, window) }))
    .sort((a, b) => b.score - a.score)
    .map(({ story }) => story);
  const [highlight = null, ...others] = ranked;
  const matches = (story: Story) =>
    matchKeywords(story.title, story.url, keywords) > 0;
  return {
    highlight,
    forYou: others.filter(matches),
    rest: others.filter((story) => !matches(story)),
  };
}
