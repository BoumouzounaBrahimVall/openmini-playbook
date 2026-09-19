import { describe, expect, it } from "vitest";
import {
  DAY_SECONDS,
  KEYWORD_BOOST,
  RECENCY_FLOOR,
  WINDOW_COUNT,
  dayWindows,
  htmlToText,
  matchKeywords,
  matchedKeywords,
  parseHits,
  rankFeed,
  score,
  searchUrl,
  windowFor,
  windowLabel,
  type Story,
} from "./feed.js";
import {
  DEFAULT_KEYWORDS,
  KEYWORDS_KEY,
  LAST_OPENED_KEY,
  addKeyword,
  parseKeywords,
  parseLastOpened,
  removeKeyword,
  serializeKeywords,
  serializeLastOpened,
} from "../prefs/store.js";
import { catchUp } from "../prefs/catchup.js";
import { hnItemUrl, parsePreview, readerUrl } from "./preview.js";

/** 2025-09-19T00:00:00Z, a fixed anchor so every window below is stable. */
const ANCHOR = 1_758_240_000;

function story(overrides: Partial<Story> = {}): Story {
  return {
    id: "1",
    title: "A story",
    url: null,
    points: 10,
    comments: 5,
    createdAt: ANCHOR - 3600,
    author: "someone",
    text: null,
    ...overrides,
  };
}

describe("day windows", () => {
  it("anchors Today so it ends at the anchor and spans 24 hours", () => {
    const today = windowFor(0, ANCHOR);
    expect(today).toEqual({
      daysAgo: 0,
      start: ANCHOR - DAY_SECONDS,
      end: ANCHOR,
    });
  });

  it("steps back a whole day per chip", () => {
    const window = windowFor(3, ANCHOR);
    expect(window.end).toBe(ANCHOR - 3 * DAY_SECONDS);
    expect(window.start).toBe(window.end - DAY_SECONDS);
  });

  it("makes neighbouring windows contiguous with no gap or overlap", () => {
    expect(windowFor(1, ANCHOR).end).toBe(windowFor(0, ANCHOR).start);
  });

  it("lists seven windows from Today outwards", () => {
    const windows = dayWindows(ANCHOR);
    expect(windows).toHaveLength(WINDOW_COUNT);
    expect(windows.map((window) => window.daysAgo)).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
  });

  it("labels the chips Today, Yesterday, then Nd", () => {
    expect(windowLabel(0)).toBe("Today");
    expect(windowLabel(1)).toBe("Yesterday");
    expect(windowLabel(2)).toBe("2d");
    expect(windowLabel(6)).toBe("6d");
  });
});

describe("searchUrl", () => {
  const url = searchUrl(windowFor(0, ANCHOR));
  const parsed = new URL(url);

  it("targets the allow-listed Algolia origin and the by-date endpoint", () => {
    expect(parsed.origin).toBe("https://hn.algolia.com");
    expect(parsed.pathname).toBe("/api/v1/search_by_date");
  });

  it("asks for stories only, one hundred per page", () => {
    expect(parsed.searchParams.get("tags")).toBe("story");
    expect(parsed.searchParams.get("hitsPerPage")).toBe("100");
  });

  it("encodes the numeric filter, which the API rejects raw with a 400", () => {
    expect(parsed.searchParams.get("numericFilters")).toBe(
      `created_at_i>=${String(ANCHOR - DAY_SECONDS)},created_at_i<${String(ANCHOR)}`,
    );
    expect(url).toContain("%3E%3D");
    expect(url).not.toContain(">=");
  });
});

describe("parseHits", () => {
  const hit = {
    author: "nextos",
    created_at: "2025-09-18T23:55:31Z",
    created_at_i: ANCHOR - 300,
    num_comments: 3,
    objectID: "45296447",
    points: 9,
    story_id: 45296447,
    title: "SailfishOS: Chum",
    url: "https://sailfishos-chum.github.io",
  };

  it("maps a hit onto a story", () => {
    expect(parseHits(JSON.stringify({ hits: [hit] }))).toEqual([
      {
        id: "45296447",
        title: "SailfishOS: Chum",
        url: "https://sailfishos-chum.github.io",
        points: 9,
        comments: 3,
        createdAt: ANCHOR - 300,
        author: "nextos",
        text: null,
      },
    ]);
  });

  it("keeps the body of a text post as plain text", () => {
    const [parsed] = parseHits(
      JSON.stringify({
        hits: [{ ...hit, story_text: "<p>Hi &amp; hello<p>Next &#x27;line&#x27;" }],
      }),
    );
    expect(parsed.text).toBe("Hi & hello Next 'line'");
  });

  it("keeps an Ask HN post, whose url field is absent", () => {
    const { url: _dropped, ...askHn } = hit;
    const [parsed] = parseHits(JSON.stringify({ hits: [askHn] }));
    expect(parsed.url).toBeNull();
    expect(parsed.title).toBe("SailfishOS: Chum");
  });

  it("reads null points and comments as zero", () => {
    const [parsed] = parseHits(
      JSON.stringify({ hits: [{ ...hit, points: null, num_comments: null }] }),
    );
    expect(parsed.points).toBe(0);
    expect(parsed.comments).toBe(0);
  });

  it("skips a hit with no title or no id rather than failing the page", () => {
    const body = JSON.stringify({
      hits: [{ ...hit, title: undefined }, { ...hit, objectID: 12 }, hit],
    });
    expect(parseHits(body)).toHaveLength(1);
  });

  it("answers an empty list for a body that is not the expected shape", () => {
    expect(parseHits("not json")).toEqual([]);
    expect(parseHits(JSON.stringify({ hits: "nope" }))).toEqual([]);
    expect(parseHits(JSON.stringify(null))).toEqual([]);
  });
});

describe("htmlToText", () => {
  it("drops tags, decodes the entities HN uses and collapses whitespace", () => {
    expect(
      htmlToText("Look at <a href=\"x\">this</a>&nbsp;&quot;quote&quot; &lt;3\n\n  ok"),
    ).toBe('Look at this "quote" <3 ok');
  });

  it("answers null for nothing or for markup with no words", () => {
    expect(htmlToText(undefined)).toBeNull();
    expect(htmlToText("<p></p>")).toBeNull();
  });
});

describe("preview", () => {
  it("builds the reader url for the allow-listed origin", () => {
    const url = readerUrl("https://blog.rust-lang.org/x?y=1");
    expect(new URL(url).origin).toBe("https://r.jina.ai");
    expect(url).toBe("https://r.jina.ai/https://blog.rust-lang.org/x?y=1");
  });

  it("links the discussion on Hacker News by story id", () => {
    expect(hnItemUrl("45296447")).toBe(
      "https://news.ycombinator.com/item?id=45296447",
    );
  });

  it("reads the description and the social image", () => {
    const body = JSON.stringify({
      data: {
        description: "  Empowering everyone.  ",
        metadata: { "og:image": "https://rust-lang.org/social.jpg" },
      },
    });
    expect(parsePreview(body)).toEqual({
      description: "Empowering everyone.",
      image: "https://rust-lang.org/social.jpg",
    });
  });

  it("falls back to the twitter image and tolerates a missing description", () => {
    const body = JSON.stringify({
      data: { metadata: { "twitter:image": "https://x.test/a.png" } },
    });
    expect(parsePreview(body)).toEqual({
      description: null,
      image: "https://x.test/a.png",
    });
  });

  it("refuses a non-https image and reads garbage as no preview", () => {
    const body = JSON.stringify({
      data: { description: "d", metadata: { "og:image": "http://x.test/a.png" } },
    });
    expect(parsePreview(body)).toEqual({ description: "d", image: null });
    expect(parsePreview("nope")).toBeNull();
    expect(parsePreview(JSON.stringify({ data: "x" }))).toBeNull();
  });
});

describe("matchKeywords", () => {
  it("does not treat a keyword inside a longer word as a match", () => {
    expect(matchKeywords("Apple said the detail chain", null, ["ai"])).toBe(0);
  });

  it("matches whole words regardless of case, once per keyword", () => {
    expect(matchKeywords("OpenAI ships AI agents for AI", null, ["ai"])).toBe(
      1,
    );
    expect(matchKeywords("Why Rust?", null, ["rust"])).toBe(1);
  });

  it("matches a multi-word keyword as a phrase", () => {
    expect(
      matchKeywords("React Native 0.80 released", null, [
        "react",
        "react native",
      ]),
    ).toBe(2);
    expect(matchKeywords("React, natively", null, ["react native"])).toBe(0);
  });

  it("searches the url hostname but not its path", () => {
    expect(
      matchKeywords("Announcing 1.90", "https://blog.rust-lang.org/x", [
        "rust",
      ]),
    ).toBe(1);
    expect(
      matchKeywords("Announcing 1.90", "https://example.com/rust", ["rust"]),
    ).toBe(0);
  });

  it("copes with a keyword containing regex characters", () => {
    expect(matchKeywords("Learning C++ today", null, ["c++"])).toBe(1);
    expect(matchKeywords("Learning C today", null, ["c++"])).toBe(0);
  });

  it("names the keywords that matched, in the order they are listed", () => {
    expect(
      matchedKeywords("Rust and AI", "https://rust-lang.org", [
        "ai",
        "rust",
        "llm",
      ]),
    ).toEqual(["ai", "rust"]);
  });

  it("ignores an unparsable url and an empty keyword list", () => {
    expect(matchKeywords("Rust", "not a url", ["rust"])).toBe(1);
    expect(matchKeywords("Rust", null, [])).toBe(0);
  });
});

describe("score", () => {
  const window = windowFor(0, ANCHOR);

  it("gives zero to a story nobody has voted on or discussed", () => {
    expect(score(story({ points: 0, comments: 0 }), [], window)).toBe(0);
  });

  it("ranks stronger crowd signal higher at equal age", () => {
    const loud = score(story({ points: 200, comments: 80 }), [], window);
    const quiet = score(story({ points: 10, comments: 2 }), [], window);
    expect(loud).toBeGreaterThan(quiet);
  });

  it("boosts a keyword match by the agreed factor", () => {
    const plain = score(story({ title: "Something" }), ["rust"], window);
    const matched = score(story({ title: "Something Rust" }), ["rust"], window);
    expect(matched).toBeCloseTo(plain * (1 + KEYWORD_BOOST), 10);
  });

  it("applies no decay at the newest edge of the window", () => {
    const fresh = score(story({ createdAt: window.end }), [], window);
    expect(fresh).toBeCloseTo(Math.log10(10 + 2 * 5 + 1), 10);
  });

  it("decays to the floor at the oldest edge, so fresher wins a tie", () => {
    const fresh = score(story({ createdAt: window.end - 60 }), [], window);
    const stale = score(story({ createdAt: window.start }), [], window);
    expect(stale).toBeLessThan(fresh);
    expect(stale).toBeCloseTo(Math.log10(21) * RECENCY_FLOOR, 10);
  });
});

describe("rankFeed", () => {
  const window = windowFor(0, ANCHOR);
  const stories = [
    story({ id: "a", title: "Quiet thing", points: 3, comments: 0 }),
    story({ id: "b", title: "Rust wins", points: 5, comments: 1 }),
    story({ id: "c", title: "Huge launch", points: 900, comments: 400 }),
    story({ id: "d", title: "Claude update", points: 4, comments: 2 }),
  ];

  it("returns an empty feed for no stories", () => {
    expect(rankFeed([], ["rust"], window)).toEqual({
      highlight: null,
      forYou: [],
      rest: [],
    });
  });

  it("promotes the top score to the highlight and splits the rest", () => {
    const feed = rankFeed(stories, ["rust", "claude"], window);
    expect(feed.highlight?.id).toBe("c");
    expect(feed.forYou.map((s) => s.id)).toEqual(["d", "b"]);
    expect(feed.rest.map((s) => s.id)).toEqual(["a"]);
  });

  it("lets a keyword match take the highlight when it outscores the crowd", () => {
    const feed = rankFeed(
      stories.filter((s) => s.id !== "c"),
      ["rust"],
      window,
    );
    expect(feed.highlight?.id).toBe("b");
    expect(feed.forYou).toEqual([]);
  });

  it("collapses to one flat list when there are no keywords", () => {
    const feed = rankFeed(stories, [], window);
    expect(feed.highlight?.id).toBe("c");
    expect(feed.forYou).toEqual([]);
    expect(feed.rest.map((s) => s.id)).toEqual(["d", "b", "a"]);
  });

  it("does not mutate the input order", () => {
    const input = [...stories];
    rankFeed(input, [], window);
    expect(input.map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("keyword storage", () => {
  it("ships the agreed defaults", () => {
    expect(DEFAULT_KEYWORDS).toEqual([
      "typescript",
      "react",
      "react native",
      "ai",
      "llm",
      "claude",
      "rust",
      "security",
    ]);
    expect(KEYWORDS_KEY).toBe("technews:keywords:v1");
  });

  it("falls back to the defaults for nothing stored, garbage, or a stale schema", () => {
    expect(parseKeywords(null)).toEqual(DEFAULT_KEYWORDS);
    expect(parseKeywords("{not json")).toEqual(DEFAULT_KEYWORDS);
    expect(parseKeywords(JSON.stringify({ version: 0, keywords: ["x"] }))).toEqual(
      DEFAULT_KEYWORDS,
    );
    expect(parseKeywords(JSON.stringify({ version: 1, keywords: "x" }))).toEqual(
      DEFAULT_KEYWORDS,
    );
  });

  it("respects an explicitly empty list instead of resurrecting the defaults", () => {
    expect(parseKeywords(JSON.stringify({ version: 1, keywords: [] }))).toEqual(
      [],
    );
  });

  it("normalises what it reads: trimmed, lower-cased, deduplicated, no blanks", () => {
    const raw = JSON.stringify({
      version: 1,
      keywords: ["  Rust ", "rust", "", "AI", 42],
    });
    expect(parseKeywords(raw)).toEqual(["rust", "ai"]);
  });

  it("round-trips through serialize and parse", () => {
    const keywords = ["rust", "react native"];
    expect(parseKeywords(serializeKeywords(keywords))).toEqual(keywords);
  });

  it("adds a normalised keyword and refuses blanks and duplicates", () => {
    const base = ["rust"];
    expect(addKeyword(base, "  React  Native ")).toEqual([
      "rust",
      "react native",
    ]);
    expect(addKeyword(base, "RUST")).toBe(base);
    expect(addKeyword(base, "   ")).toBe(base);
    expect(base).toEqual(["rust"]);
  });

  it("removes a keyword without touching the original", () => {
    const base = ["rust", "ai"];
    expect(removeKeyword(base, "rust")).toEqual(["ai"]);
    expect(base).toEqual(["rust", "ai"]);
  });
});

describe("last-opened storage", () => {
  it("uses the agreed versioned key", () => {
    expect(LAST_OPENED_KEY).toBe("technews:lastOpened:v1");
  });

  it("reads nothing, garbage and impossible values as never opened", () => {
    expect(parseLastOpened(null)).toBeNull();
    expect(parseLastOpened("{oops")).toBeNull();
    expect(parseLastOpened(JSON.stringify({ version: 1, at: -5 }))).toBeNull();
    expect(parseLastOpened(JSON.stringify({ version: 1, at: "12" }))).toBeNull();
    expect(parseLastOpened(JSON.stringify({ version: 2, at: 12 }))).toBeNull();
  });

  it("round-trips a timestamp in seconds", () => {
    expect(parseLastOpened(serializeLastOpened(ANCHOR))).toBe(ANCHOR);
  });
});

describe("catchUp", () => {
  it("shows nothing on a first launch or a same-day return", () => {
    expect(catchUp(null, ANCHOR)).toBeNull();
    expect(catchUp(ANCHOR - 2 * 3600, ANCHOR)).toBeNull();
  });

  it("counts whole days away and the chips that were never seen", () => {
    expect(catchUp(ANCHOR - 3 * DAY_SECONDS, ANCHOR)).toEqual({
      awayDays: 3,
      unseenDaysAgo: [1, 2],
    });
  });

  it("reports one day away with no fully unseen chip after a day and a half", () => {
    expect(catchUp(ANCHOR - 1.5 * DAY_SECONDS, ANCHOR)).toEqual({
      awayDays: 1,
      unseenDaysAgo: [],
    });
  });

  it("caps the unseen chips at the six that exist", () => {
    expect(catchUp(ANCHOR - 30 * DAY_SECONDS, ANCHOR)).toEqual({
      awayDays: 30,
      unseenDaysAgo: [1, 2, 3, 4, 5, 6],
    });
  });
});
