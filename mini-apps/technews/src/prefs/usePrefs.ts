import { mini } from "@openmini/runtime";
import { useCallback, useEffect, useState } from "react";
import { catchUp, type CatchUp } from "./catchup.js";
import {
  DEFAULT_KEYWORDS,
  addKeyword,
  loadKeywords,
  loadLastOpened,
  removeKeyword,
  saveKeywords,
  saveLastOpened,
  type KvStorage,
} from "./store.js";

/**
 * The bridge's key/value store, narrowed to the port the prefs module asks
 * for. This hook is the only place the two meet, so the parsers stay testable
 * against plain strings.
 */
const storage: KvStorage = {
  get: (key: string) => mini.storage.get(key),
  set: (key: string, value: string) => mini.storage.set(key, value),
};

interface UsePrefs {
  keywords: readonly string[];
  /** False until storage has answered; nothing is written before then. */
  hydrated: boolean;
  /** What to say about the time away, or null when there is nothing to say. */
  catchUp: CatchUp | null;
  add: (raw: string) => void;
  remove: (keyword: string) => void;
}

/**
 * Keywords and the last-opened stamp. The stamp is read once, compared with
 * `now`, then overwritten in the same breath, so the banner describes this
 * launch and the next one starts a fresh count.
 */
export function usePrefs(now: number): UsePrefs {
  const [keywords, setKeywords] = useState<readonly string[]>(DEFAULT_KEYWORDS);
  const [hydrated, setHydrated] = useState(false);
  const [away, setAway] = useState<CatchUp | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadKeywords(storage), loadLastOpened(storage)])
      .then(([saved, lastOpened]) => {
        if (cancelled) return;
        setKeywords(saved);
        setAway(catchUp(lastOpened, now));
        setHydrated(true);
        return saveLastOpened(storage, now);
      })
      .catch((error: unknown) => {
        console.error("technews: failed to load preferences", error);
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [now]);

  // Persisting before hydration would overwrite the saved list with defaults.
  useEffect(() => {
    if (!hydrated) return;
    saveKeywords(storage, keywords).catch((error: unknown) => {
      console.error("technews: failed to persist keywords", error);
    });
  }, [keywords, hydrated]);

  const add = useCallback((raw: string) => {
    setKeywords((current) => addKeyword(current, raw));
  }, []);

  const remove = useCallback((keyword: string) => {
    setKeywords((current) => removeKeyword(current, keyword));
  }, []);

  return { keywords, hydrated, catchUp: away, add, remove };
}
