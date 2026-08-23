/**
 * Persistence for the two things that outlive a round: the setup and the
 * recent-word buffer. A dealt round is deliberately never written — a
 * backgrounded app resumes at setup rather than resurrecting a half-dealt round
 * whose secrecy cannot be reasoned about.
 *
 * One injected port, `KvStorage`, so nothing here imports React or the bridge.
 * Stored strings are untrusted input: every deserializer is total and answers
 * with a fresh default rather than throwing, and derived fields are recomputed
 * from `content/types.js` rather than trusted.
 *
 * Depends on `session.ts` (the rules) and never the reverse. The one rule that
 * spans both modules — the recents holdback — lives in `startRound`, not here;
 * this module only moves the buffer to and from storage. Both halves are
 * exercised together from the single `session.test.ts`.
 */
import {
  DEFAULT_SETUP,
  RECENTS_LIMIT,
  normalizeName,
  type Setup,
} from "./session.js";
import {
  CATEGORY_IDS,
  LEVEL_IDS,
  type CategoryId,
  type Level,
} from "../content/types.js";

/** The slice of the host's key/value storage this module needs. */
export interface KvStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/** Versioned so a future schema change is discarded, not crashed on. */
export const SETUP_KEY = "imposter:setup:v1";
export const RECENTS_KEY = "imposter:recents:v1";
/** Schema stamp inside each stored payload; a mismatch reads as stale. */
export const SCHEMA_VERSION = 1;

/** What survived a load from storage. */
export interface PersistedSession {
  setup: Setup;
  recents: readonly string[];
}

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
  return LEVEL_IDS.some((level) => level === value);
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
    levels: LEVEL_IDS.filter((level) => levels.includes(level)),
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
