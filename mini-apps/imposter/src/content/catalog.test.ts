import { describe, expect, it } from "vitest";
import { CATALOG } from "./en/index.js";
import { CATEGORY_IDS, type CategoryId, type WordEntry } from "./types.js";

/**
 * Seam 2 is a data contract, not a code seam: 1000 hand-authored entries whose
 * defects are invisible in review and fatal in play. Every assertion below
 * guards one of those defects, and every count is a hard number — changing a
 * category's size is meant to be a decision that updates this file, not a
 * silent drift.
 */

/** Hard count required of every category. A truncated paste must fail here. */
const ENTRIES_PER_CATEGORY = 200;

/** The easiest difficulty must never starve, so tier 1 has a floor. */
const MIN_TIER_ONE_ENTRIES = 40;

const ALLOWED_LEVELS: readonly number[] = [1, 2, 3];

/**
 * Words that name one of the five categories (or the generic nouns a category
 * stands in for). A hint that says "food" tells the imposter which category the
 * round was drawn from, which story 28 forbids. Plurals are derived, not listed.
 */
const CATEGORY_WORDS: readonly string[] = [
  "food",
  "drink",
  "animal",
  "place",
  "job",
  "object",
  "thing",
  "item",
];

const FORBIDDEN_HINTS: ReadonlySet<string> = new Set(
  CATEGORY_WORDS.flatMap((noun) => [noun, `${noun}s`]),
);

/**
 * Stemmer for the hint/word overlap check, ported verbatim from the negative-
 * tested reference. A naive strip of `s`/`es`/`ing`/`ed` silently passes the
 * cases this rule exists to catch — Iceland/"icy", Waterfall/"watery",
 * Mudflat/"muddy" — because no substring relation survives the suffix. So this
 * one also strips derivational suffixes (`y`/`ly`/`ish`/`en`/`ous`/`ic`/`al`/
 * `able`/`ness`...) and collapses a doubled final consonant, which turns
 * "icy" into "ic", "muddy" into "mud" and "volcanic" into "volcan".
 */
function stem(raw: string): string {
  const letters = raw.toLowerCase().replace(/[^a-z]/g, "");
  // Derivational then inflectional suffixes; the anchor makes the longest win.
  const stripped = letters.replace(
    /(ations|ation|ically|ingly|ously|iness|ness|ible|able|ical|ings|ing|ous|ish|ily|ies|ied|ers|est|eth|ely|en|ed|er|ly|es|al|ic|y|s)$/,
    "",
  );
  if (/[^aeiou]$/.test(stripped) && stripped.length > 2) {
    // "mudd" -> "mud", "sandd" never occurs but "runn" -> "run" does.
    const collapsed = stripped.replace(/([bdfglmnprstz])\1$/, "$1");
    if (collapsed !== stripped) return collapsed;
  }
  return stripped;
}

/**
 * Two stems collide if either contains the other (at three characters or more,
 * so short accidents like "ox" inside "box" do not fire), or if an `-e`/`-y`
 * variant of one matches the other — the step that links "ic" back to "ice".
 */
function sharesStem(a: string, b: string): boolean {
  if (a === "" || b === "") return false;
  const variants = (x: string): readonly string[] => [x, `${x}e`, x.replace(/e$/, "")];
  for (const left of variants(a)) {
    for (const right of variants(b)) {
      if (left === right) return true;
      if (left.length >= 3 && right.includes(left)) return true;
      if (right.length >= 3 && left.includes(right)) return true;
    }
  }
  return false;
}

/** Every entry of every category, tagged with the category it came from. */
const ALL_ENTRIES: ReadonlyArray<readonly [CategoryId, WordEntry]> = CATEGORY_IDS.flatMap(
  (id) => CATALOG[id].map((entry) => [id, entry] as const),
);

/** Values appearing more than once in `values`, in first-seen order. */
function duplicatesOf(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

/** A one-line label for a failing entry, so the message names the culprit. */
function label(id: CategoryId, entry: WordEntry): string {
  return `${id}: ${entry.word} / ${entry.hint}`;
}

describe("catalog shape", () => {
  it("holds exactly five categories", () => {
    expect(Object.keys(CATALOG)).toHaveLength(5);
  });

  it("exposes an entry list for every declared category id", () => {
    for (const id of CATEGORY_IDS) {
      expect(Array.isArray(CATALOG[id])).toBe(true);
    }
  });

  it.each(CATEGORY_IDS)("%s holds exactly 200 entries", (id) => {
    expect(CATALOG[id]).toHaveLength(ENTRIES_PER_CATEGORY);
  });

  it("holds 1000 entries in total", () => {
    expect(ALL_ENTRIES).toHaveLength(5 * ENTRIES_PER_CATEGORY);
  });
});

describe("entry fields", () => {
  it.each(CATEGORY_IDS)("%s gives every entry a non-empty word", (id) => {
    const offenders = CATALOG[id]
      .filter((entry) => entry.word.trim() === "")
      .map((entry) => label(id, entry));
    expect(offenders).toEqual([]);
  });

  it.each(CATEGORY_IDS)("%s gives every entry a non-empty hint", (id) => {
    const offenders = CATALOG[id]
      .filter((entry) => entry.hint.trim() === "")
      .map((entry) => label(id, entry));
    expect(offenders).toEqual([]);
  });

  it.each(CATEGORY_IDS)("%s tiers every entry at level 1, 2 or 3", (id) => {
    const offenders = CATALOG[id]
      .filter((entry) => !ALLOWED_LEVELS.includes(entry.level))
      .map((entry) => `${label(id, entry)} (level ${String(entry.level)})`);
    expect(offenders).toEqual([]);
  });
});

describe("hint form", () => {
  /**
   * One lowercase word, nothing else. `/^[a-z]+$/` proves all three properties
   * at once: single word (no whitespace can match), lowercase, and free of
   * punctuation, commas and hyphens. A crew member sees one word, so an
   * imposter must too — a longer hint is visibly different from two feet away,
   * which is the leak the layout-identical reveal exists to prevent.
   */
  it.each(CATEGORY_IDS)("%s hints are each a single lowercase word", (id) => {
    const offenders = CATALOG[id]
      .filter((entry) => !/^[a-z]+$/.test(entry.hint))
      .map((entry) => label(id, entry));
    expect(offenders).toEqual([]);
  });
});

describe("hint independence from its word", () => {
  /**
   * The single most likely authoring mistake, and one that silently hands the
   * answer to the imposter. Checked in both directions and against every
   * whitespace-separated component of a multi-word word, so "Fried Chicken"
   * cannot be hinted "chicken" or "frying".
   */
  it.each(CATEGORY_IDS)("%s hints share no stem with their own word", (id) => {
    const offenders = CATALOG[id]
      .filter((entry) => {
        const hintStem = stem(entry.hint);
        return entry.word
          .split(/\s+/)
          .some((part) => sharesStem(stem(part), hintStem));
      })
      .map((entry) => label(id, entry));
    expect(offenders).toEqual([]);
  });
});

describe("word uniqueness", () => {
  it.each(CATEGORY_IDS)("%s repeats no word within itself", (id) => {
    expect(duplicatesOf(CATALOG[id].map((entry) => entry.word))).toEqual([]);
  });

  // Globally unique too, so a multi-category draw cannot be biased towards a
  // word that happens to sit in two pools.
  it("repeats no word across the five categories", () => {
    expect(duplicatesOf(ALL_ENTRIES.map(([, entry]) => entry.word))).toEqual([]);
  });
});

describe("hint uniqueness", () => {
  it.each(CATEGORY_IDS)("%s holds 200 distinct hints", (id) => {
    expect(new Set(CATALOG[id].map((entry) => entry.hint)).size).toBe(
      ENTRIES_PER_CATEGORY,
    );
  });

  /**
   * Cross-category hint reuse is deliberately ALLOWED, and this test exists to
   * document that rather than to forbid it. A hint used in two categories —
   * "quiet" for a Library and for a Mouse — stops the imposter inferring which
   * category the round was drawn from, which is exactly what story 28 asks for.
   * Making hints globally unique would turn every hint into a category
   * fingerprint. The word is the identifier; the hint is not.
   */
  it("reuses some hints across categories, so a hint cannot fingerprint a category", () => {
    const shared = duplicatesOf(ALL_ENTRIES.map(([, entry]) => entry.hint));
    expect(shared.length).toBeGreaterThan(0);
  });
});

describe("difficulty distribution", () => {
  it.each(CATEGORY_IDS)("%s holds at least 40 tier-1 entries", (id) => {
    const tierOne = CATALOG[id].filter((entry) => entry.level === 1);
    expect(tierOne.length).toBeGreaterThanOrEqual(MIN_TIER_ONE_ENTRIES);
  });
});

describe("hints never name a category", () => {
  it.each(CATEGORY_IDS)("%s uses no category name or plural as a hint", (id) => {
    const offenders = CATALOG[id]
      .filter((entry) => FORBIDDEN_HINTS.has(entry.hint))
      .map((entry) => label(id, entry));
    expect(offenders).toEqual([]);
  });
});
