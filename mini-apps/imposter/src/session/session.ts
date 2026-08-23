/**
 * The whole game, as one module. Setup, validation, the round draw and the
 * persistence of both live behind this single surface, because the load-bearing
 * rule -- "recently drawn words are excluded from the draw" -- spans the draw
 * and storage at once and cannot be tested through two sibling modules.
 *
 * Two ports are injected: `Random` (a trailing parameter defaulting to
 * `Math.random`) and `KvStorage`. Nothing here imports React or the bridge.
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

/** The slice of the host's key/value storage this module needs. */
export interface KvStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/* ---- rules, fixed for 0.1.0 ---- */

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const MAX_NAME_LENGTH = 24;
/** How many recently drawn words are held back from the draw. */
export const RECENTS_LIMIT = 30;

/* ---- storage ---- */

/** Versioned so a future schema change is discarded, not crashed on. */
export const SETUP_KEY = "imposter:setup:v1";
export const RECENTS_KEY = "imposter:recents:v1";
/** Schema stamp inside each stored payload; a mismatch reads as stale. */
export const SCHEMA_VERSION = 1;

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

/** What survived a load from storage. */
export interface PersistedSession {
  setup: Setup;
  recents: readonly string[];
}

/* ---- validation ---- */

function normalizeName(name: string): string {
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

function pick<T>(items: readonly T[], random: Random): T {
  return items[Math.floor(random() * items.length)];
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

  // Recent words are held back. If they cover the whole filtered pool the
  // buffer clears and the draw proceeds, so a narrow selection degrades to
  // repeats instead of failing.
  const held = new Set(recents);
  const unseen = candidates.filter((entry) => !held.has(entry.word));
  const exhausted = unseen.length === 0;
  const survivors = exhausted ? candidates : unseen;
  const carried = exhausted ? [] : recents;

  const entry = pick(survivors, random);
  const players = setup.roster.map(normalizeName);
  const imposterIndex = Math.floor(random() * players.length);
  const starterIndex = Math.floor(random() * players.length);

  const secrets: PlayerSecret[] = players.map((name, index) => {
    const imposter = index === imposterIndex;
    return {
      name,
      imposter,
      word: imposter ? null : entry.word,
      hint: imposter ? entry.hint : null,
    };
  });

  return {
    ok: true,
    round: {
      players,
      imposterIndices: [imposterIndex],
      starterIndex,
      secrets,
      word: entry.word,
      hint: entry.hint,
    },
    recents: [...carried, entry.word].slice(-RECENTS_LIMIT),
  };
}

/* ---- persistence: only setup and recents are ever written ---- */

interface StoredSetup {
  version: number;
  roster: string[];
  categories: CategoryId[];
  levels: Level[];
}

interface StoredRecents {
  version: number;
  words: string[];
}

export function serializeSetup(setup: Setup): string {
  const stored: StoredSetup = {
    version: SCHEMA_VERSION,
    roster: [...setup.roster],
    categories: [...setup.categories],
    levels: [...setup.levels],
  };
  return JSON.stringify(stored);
}

export function serializeRecents(recents: readonly string[]): string {
  const stored: StoredRecents = {
    version: SCHEMA_VERSION,
    words: recents.slice(-RECENTS_LIMIT),
  };
  return JSON.stringify(stored);
}

/** Stored strings are untrusted input; anything unprovable reads as absent. */
function readPayload(raw: string | null): Record<string, unknown> | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const payload = parsed as Record<string, unknown>;
  if (payload.version !== SCHEMA_VERSION) return null;
  return payload;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCategoryId(value: unknown): value is CategoryId {
  return CATEGORY_IDS.some((id) => id === value);
}

function isLevel(value: unknown): value is Level {
  return value === 1 || value === 2 || value === 3;
}

/** Total: corrupt, truncated and stale-schema payloads give DEFAULT_SETUP. */
export function parseSetup(raw: string | null): Setup {
  const payload = readPayload(raw);
  if (payload === null) return DEFAULT_SETUP;
  const { roster, categories, levels } = payload;
  if (
    !Array.isArray(roster) ||
    !roster.every(isNonEmptyString) ||
    !Array.isArray(categories) ||
    !categories.every(isCategoryId) ||
    !Array.isArray(levels) ||
    !levels.every(isLevel)
  ) {
    return DEFAULT_SETUP;
  }
  return {
    roster: roster.map(normalizeName),
    // Deduplicated and re-ordered from the source of truth rather than trusted.
    categories: CATEGORY_IDS.filter((id) => categories.includes(id)),
    levels: ([1, 2, 3] as const).filter((level) => levels.includes(level)),
  };
}

/** Total: corrupt, truncated and stale-schema payloads give an empty buffer. */
export function parseRecents(raw: string | null): readonly string[] {
  const payload = readPayload(raw);
  if (payload === null) return [];
  const { words } = payload;
  if (!Array.isArray(words) || !words.every(isNonEmptyString)) return [];
  return [...new Set(words)].slice(-RECENTS_LIMIT);
}

/** Read both persisted keys. Never throws on the stored data itself. */
export async function loadSession(
  storage: KvStorage,
): Promise<PersistedSession> {
  const [setupRaw, recentsRaw] = await Promise.all([
    storage.get(SETUP_KEY),
    storage.get(RECENTS_KEY),
  ]);
  return { setup: parseSetup(setupRaw), recents: parseRecents(recentsRaw) };
}

export async function saveSetup(
  storage: KvStorage,
  setup: Setup,
): Promise<void> {
  await storage.set(SETUP_KEY, serializeSetup(setup));
}

export async function saveRecents(
  storage: KvStorage,
  recents: readonly string[],
): Promise<void> {
  await storage.set(RECENTS_KEY, serializeRecents(recents));
}
