/**
 * The rules of the game: what a playable setup is, and how one round is dealt
 * from the catalog. Pure — one injected port, `Random` (a trailing parameter
 * defaulting to `Math.random`). Nothing here reads or writes storage, imports
 * React, or touches the bridge.
 *
 * The sibling `store.ts` serialises the two things that outlive a round (the
 * setup and the recent-word buffer) and depends on this module, never the other
 * way round. The one rule that spans both -- "recently drawn words are held
 * back from the draw" -- lives here, in `startRound`, which takes the buffer as
 * an argument and hands the next one back; `store.ts` only persists it. Both
 * halves are exercised together from the single `session.test.ts`.
 */
import { CATALOG } from "../content/en/index.js";
import {
  CATEGORY_IDS,
  type Catalog,
  type CategoryId,
  type Level,
  type WordEntry,
} from "../content/types.js";

/** Injected random source, yielding `[0, 1)` like `Math.random`. */
export type Random = () => number;

/* ---- rules, fixed for 0.1.0 ---- */

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const MAX_NAME_LENGTH = 24;
/** How many recently drawn words are held back from the draw. */
export const RECENTS_LIMIT = 30;

/* ---- setup ---- */

/** Everything the organizer chooses before a round is dealt. */
export interface Setup {
  roster: readonly string[];
  categories: readonly CategoryId[];
  levels: readonly Level[];
}

/** Empty roster, every category, level 3 opt-in. */
export const DEFAULT_SETUP: Setup = {
  roster: [],
  categories: CATEGORY_IDS,
  levels: [1, 2],
};

/** Why a setup cannot begin a round. One value per distinguishable cause. */
export type SetupProblem =
  | "emptyName"
  | "nameTooLong"
  | "duplicateName"
  | "tooFewPlayers"
  | "tooManyPlayers"
  | "noCategories"
  | "noLevels"
  | "emptyPool";

/** A rejection: the machine-readable cause plus the sentence to show. */
export interface SetupRejection {
  problem: SetupProblem;
  message: string;
}

/* ---- round ---- */

/** What one player sees while holding the reveal. Never carries the category. */
export interface PlayerSecret {
  name: string;
  /** The explicit designation: exactly one player in a round has this set. */
  imposter: boolean;
  /** The shared word. `null` for the imposter, who never receives it. */
  word: string | null;
  /** The bluffing hint. `null` for crew, who receive the word instead. */
  hint: string | null;
}

/**
 * One dealt round. Never persisted: a backgrounded app resumes at setup rather
 * than resurrecting a half-dealt round whose secrecy cannot be reasoned about.
 */
export interface Round {
  /** Trimmed roster, in the order the phone is passed. */
  players: readonly string[];
  /**
   * Modelled as a list even though exactly one imposter is drawn, so that a
   * second imposter later is a draw change rather than a rewrite of the pass
   * loop and the reveal screen.
   */
  imposterIndices: readonly number[];
  /** Index into `players` of whoever speaks first. */
  starterIndex: number;
  /** Per-player secrets, index-aligned with `players`. */
  secrets: readonly PlayerSecret[];
  /** The drawn word, for the reveal screen only. */
  word: string;
  /** The imposter's hint, for the reveal screen only. */
  hint: string;
}

/** Either a dealt round plus the recents buffer to persist, or a rejection. */
export type StartRoundResult =
  | { ok: true; round: Round; recents: readonly string[] }
  | { ok: false; rejection: SetupRejection };

/* ---- validation ---- */

/**
 * The one definition of a roster name's canonical form. Exported because a
 * restored setup has to be normalized the same way a freshly typed one is --
 * `store.ts` applies it on the way back in from storage.
 */
export function normalizeName(name: string): string {
  return name.trim();
}

function nameKey(name: string): string {
  return normalizeName(name).toLowerCase();
}

function reject(problem: SetupProblem, message: string): SetupRejection {
  return { problem, message };
}

/**
 * Rules for a name about to be added to the roster, so the setup screen can
 * refuse it at the input instead of silently shortening it. `null` when fine.
 */
export function validateNewName(
  roster: readonly string[],
  name: string,
): SetupRejection | null {
  const trimmed = normalizeName(name);
  if (trimmed.length === 0) {
    return reject("emptyName", "Enter a name.");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return reject(
      "nameTooLong",
      `Names can be at most ${String(MAX_NAME_LENGTH)} characters.`,
    );
  }
  if (roster.some((existing) => nameKey(existing) === nameKey(trimmed))) {
    return reject("duplicateName", `${trimmed} is already in the game.`);
  }
  if (roster.length >= MAX_PLAYERS) {
    return reject(
      "tooManyPlayers",
      `At most ${String(MAX_PLAYERS)} players can play.`,
    );
  }
  return null;
}

/** Everything that blocks a round, checked in order. `null` when playable. */
export function validateSetup(setup: Setup): SetupRejection | null {
  for (const name of setup.roster) {
    const trimmed = normalizeName(name);
    if (trimmed.length === 0) {
      return reject("emptyName", "Every player needs a name.");
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      return reject(
        "nameTooLong",
        `Names can be at most ${String(MAX_NAME_LENGTH)} characters.`,
      );
    }
  }
  const keys = new Set(setup.roster.map(nameKey));
  if (keys.size !== setup.roster.length) {
    return reject("duplicateName", "Two players share a name.");
  }
  if (setup.roster.length < MIN_PLAYERS) {
    return reject(
      "tooFewPlayers",
      `Add at least ${String(MIN_PLAYERS)} players.`,
    );
  }
  if (setup.roster.length > MAX_PLAYERS) {
    return reject(
      "tooManyPlayers",
      `At most ${String(MAX_PLAYERS)} players can play.`,
    );
  }
  if (setup.categories.length === 0) {
    return reject("noCategories", "Pick at least one category.");
  }
  if (setup.levels.length === 0) {
    return reject("noLevels", "Pick at least one difficulty.");
  }
  return null;
}

/* ---- the draw ---- */

/**
 * Entries matching the active category and difficulty filters. Iterated in
 * `CATEGORY_IDS` order so the pool -- and therefore the draw -- does not depend
 * on the order the setup screen happens to hold the selection in.
 */
function filterPool(pool: Catalog, setup: Setup): WordEntry[] {
  const categories = new Set(setup.categories);
  const levels = new Set<Level>(setup.levels);
  const entries: WordEntry[] = [];
  for (const id of CATEGORY_IDS) {
    if (!categories.has(id)) continue;
    for (const entry of pool[id]) {
      if (levels.has(entry.level)) entries.push(entry);
    }
  }
  return entries;
}

/** A uniform index into `items`: the one place `random()` becomes a position. */
function pickIndex(items: readonly unknown[], random: Random): number {
  return Math.floor(random() * items.length);
}

function pick<T>(items: readonly T[], random: Random): T {
  return items[pickIndex(items, random)];
}

/**
 * The recents holdback. Words drawn recently are removed from the candidates,
 * unless that would empty the pool -- then the buffer clears and the full pool
 * is drawn from, so a narrow category/difficulty selection degrades to repeats
 * instead of failing. `carried` is the buffer the next draw should build on.
 */
function afterHoldback(
  candidates: readonly WordEntry[],
  recents: readonly string[],
): { survivors: readonly WordEntry[]; carried: readonly string[] } {
  const held = new Set(recents);
  const unseen = candidates.filter((entry) => !held.has(entry.word));
  return unseen.length === 0
    ? { survivors: candidates, carried: [] }
    : { survivors: unseen, carried: recents };
}

/**
 * Per-player secrets, index-aligned with `players`: the imposter gets the hint
 * and no word, everyone else gets the word and no hint. Never the category.
 */
function dealSecrets(
  players: readonly string[],
  imposterIndex: number,
  entry: WordEntry,
): PlayerSecret[] {
  return players.map((name, index) => {
    const imposter = index === imposterIndex;
    return {
      name,
      imposter,
      word: imposter ? null : entry.word,
      hint: imposter ? entry.hint : null,
    };
  });
}

/**
 * Deal a round: draw a word, one imposter and a starter. Also used to re-draw
 * for a new round -- pass the same setup and the recents this returned last
 * time. `random` is consumed in a fixed order: word, imposter, starter.
 */
export function startRound(
  setup: Setup,
  recents: readonly string[] = [],
  pool: Catalog = CATALOG,
  random: Random = Math.random,
): StartRoundResult {
  const rejection = validateSetup(setup);
  if (rejection) return { ok: false, rejection };

  const candidates = filterPool(pool, setup);
  if (candidates.length === 0) {
    return {
      ok: false,
      rejection: reject(
        "emptyPool",
        "No words match those categories and difficulty.",
      ),
    };
  }

  const { survivors, carried } = afterHoldback(candidates, recents);
  // Fixed consumption order -- word, then imposter, then starter.
  const entry = pick(survivors, random);
  const players = setup.roster.map(normalizeName);
  const imposterIndex = pickIndex(players, random);
  const starterIndex = pickIndex(players, random);

  return {
    ok: true,
    round: {
      players,
      imposterIndices: [imposterIndex],
      starterIndex,
      secrets: dealSecrets(players, imposterIndex, entry),
      word: entry.word,
      hint: entry.hint,
    },
    recents: [...carried, entry.word].slice(-RECENTS_LIMIT),
  };
}
