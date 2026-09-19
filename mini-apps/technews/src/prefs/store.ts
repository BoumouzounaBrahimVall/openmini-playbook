/**
 * Persistence for the two things that outlive a session: the keyword list and
 * the last-opened timestamp. Same shape as imposter's `session/store.ts`: one
 * injected `KvStorage` port so nothing here touches the bridge, versioned keys,
 * and total parsers that answer a default instead of throwing on corrupt or
 * stale data.
 */

/** The slice of the host's key/value storage this module needs. */
export interface KvStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export const KEYWORDS_KEY = "technews:keywords:v1";
export const LAST_OPENED_KEY = "technews:lastOpened:v1";
/** Schema stamp inside each payload; a mismatch reads as stale. */
export const SCHEMA_VERSION = 1;

export const DEFAULT_KEYWORDS: readonly string[] = [
  "typescript",
  "react",
  "react native",
  "ai",
  "llm",
  "claude",
  "rust",
  "security",
];

interface StoredKeywords {
  version: number;
  keywords: string[];
}

interface StoredLastOpened {
  version: number;
  /** Unix seconds. */
  at: number;
}

/** Lower-cased, trimmed, inner whitespace collapsed. Empty when nothing is left. */
export function normalizeKeyword(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** A new list with the keyword appended, or the same list if it adds nothing. */
export function addKeyword(
  keywords: readonly string[],
  raw: string,
): readonly string[] {
  const keyword = normalizeKeyword(raw);
  if (keyword.length === 0 || keywords.includes(keyword)) return keywords;
  return [...keywords, keyword];
}

export function removeKeyword(
  keywords: readonly string[],
  keyword: string,
): readonly string[] {
  return keywords.filter((existing) => existing !== keyword);
}

export function serializeKeywords(keywords: readonly string[]): string {
  const stored: StoredKeywords = {
    version: SCHEMA_VERSION,
    keywords: [...keywords],
  };
  return JSON.stringify(stored);
}

export function serializeLastOpened(at: number): string {
  const stored: StoredLastOpened = { version: SCHEMA_VERSION, at };
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

/**
 * Total: nothing stored, corrupt or stale gives the defaults. An explicitly
 * empty list is a choice the user made and is kept.
 */
export function parseKeywords(raw: string | null): readonly string[] {
  const payload = readPayload(raw);
  if (payload === null) return DEFAULT_KEYWORDS;
  const { keywords } = payload;
  if (!Array.isArray(keywords)) return DEFAULT_KEYWORDS;
  const cleaned = keywords
    .filter((value): value is string => typeof value === "string")
    .map(normalizeKeyword)
    .filter((keyword) => keyword.length > 0);
  return [...new Set(cleaned)];
}

/** Total: anything but a positive finite number of seconds reads as never. */
export function parseLastOpened(raw: string | null): number | null {
  const payload = readPayload(raw);
  if (payload === null) return null;
  const { at } = payload;
  if (typeof at !== "number" || !Number.isFinite(at) || at <= 0) return null;
  return at;
}

export async function loadKeywords(
  storage: KvStorage,
): Promise<readonly string[]> {
  return parseKeywords(await storage.get(KEYWORDS_KEY));
}

export async function saveKeywords(
  storage: KvStorage,
  keywords: readonly string[],
): Promise<void> {
  await storage.set(KEYWORDS_KEY, serializeKeywords(keywords));
}

export async function loadLastOpened(
  storage: KvStorage,
): Promise<number | null> {
  return parseLastOpened(await storage.get(LAST_OPENED_KEY));
}

export async function saveLastOpened(
  storage: KvStorage,
  at: number,
): Promise<void> {
  await storage.set(LAST_OPENED_KEY, serializeLastOpened(at));
}
