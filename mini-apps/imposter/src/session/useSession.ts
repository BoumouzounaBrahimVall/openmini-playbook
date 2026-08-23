import { mini } from "@openmini/runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_SETUP,
  startRound,
  validateNewName,
  type Setup,
  type SetupRejection,
  type StartRoundResult,
} from "./session.js";
import {
  loadSession,
  saveRecents,
  saveSetup,
  type KvStorage,
} from "./store.js";
import type { CategoryId, Level } from "../content/types.js";

/**
 * The bridge's key/value store, narrowed to the port the session module asks
 * for. This hook is the only place the two are wired together — the session
 * module stays free of `mini.*` so it can be tested against a fake.
 */
const storage: KvStorage = {
  get: (key: string) => mini.storage.get(key),
  set: (key: string, value: string) => mini.storage.set(key, value),
};

interface UseSession {
  setup: Setup;
  /** False until storage has answered; the setup screen waits on it. */
  hydrated: boolean;
  /** The reason the name was refused, or `null` once it has been added. */
  addPlayer: (name: string) => SetupRejection | null;
  removePlayer: (index: number) => void;
  /** Reorder the roster; roster order is the order the phone is passed in. */
  movePlayer: (from: number, to: number) => void;
  toggleCategory: (id: CategoryId) => void;
  toggleLevel: (level: Level) => void;
  /** Deal a round (also the "new round" re-draw) and persist the new recents. */
  deal: () => StartRoundResult;
}

export function useSession(): UseSession {
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP);
  // Persisting before hydration finishes would overwrite the stored setup with
  // the defaults, so writes stay off until the load resolves.
  const [hydrated, setHydrated] = useState(false);
  const setupRef = useRef(setup);
  setupRef.current = setup;
  const hydratedRef = useRef(hydrated);
  hydratedRef.current = hydrated;
  // Recents never render, so they live in a ref: the draw reads them and hands
  // the next buffer back. Round state itself is never held here at all.
  const recentsRef = useRef<readonly string[]>([]);

  // Restore the saved setup and the recent-word buffer.
  useEffect(() => {
    let cancelled = false;
    void loadSession(storage)
      .then((session) => {
        if (cancelled) return;
        recentsRef.current = session.recents;
        setSetup(session.setup);
        setHydrated(true);
      })
      .catch((error: unknown) => {
        console.error("imposter: failed to load saved session", error);
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist the setup after every change, and flush on host-driven teardown.
  useEffect(() => {
    if (!hydrated) return;
    void persistSetup(setup);
  }, [setup, hydrated]);
  useEffect(() => {
    const flush = () => {
      if (!hydratedRef.current) return;
      void persistSetup(setupRef.current);
      void persistRecents(recentsRef.current);
    };
    const offDestroy = mini.lifecycle.onDestroy(flush);
    const offHide = mini.lifecycle.onHide(flush);
    return () => {
      offDestroy();
      offHide();
    };
  }, []);

  const addPlayer = useCallback((name: string): SetupRejection | null => {
    // The ref is read only to answer the caller synchronously with a rejection;
    // the write itself goes through the updater, like every sibling here, so it
    // cannot be built on a roster that has already moved on.
    const rejection = validateNewName(setupRef.current.roster, name);
    if (rejection) return rejection;
    const trimmed = name.trim();
    setSetup((current) => ({
      ...current,
      roster: [...current.roster, trimmed],
    }));
    return null;
  }, []);

  const removePlayer = useCallback((index: number) => {
    setSetup((current) => ({
      ...current,
      roster: current.roster.filter((_, i) => i !== index),
    }));
  }, []);

  const movePlayer = useCallback((from: number, to: number) => {
    setSetup((current) => {
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= current.roster.length ||
        to >= current.roster.length
      ) {
        return current;
      }
      const roster = [...current.roster];
      const [moved] = roster.splice(from, 1);
      roster.splice(to, 0, moved);
      return { ...current, roster };
    });
  }, []);

  const toggleCategory = useCallback((id: CategoryId) => {
    setSetup((current) => ({
      ...current,
      categories: current.categories.includes(id)
        ? current.categories.filter((existing) => existing !== id)
        : [...current.categories, id],
    }));
  }, []);

  const toggleLevel = useCallback((level: Level) => {
    setSetup((current) => ({
      ...current,
      levels: current.levels.includes(level)
        ? current.levels.filter((existing) => existing !== level)
        : [...current.levels, level],
    }));
  }, []);

  const deal = useCallback((): StartRoundResult => {
    const result = startRound(setupRef.current, recentsRef.current);
    if (result.ok) {
      recentsRef.current = result.recents;
      void persistRecents(result.recents);
    }
    return result;
  }, []);

  return {
    setup,
    hydrated,
    addPlayer,
    removePlayer,
    movePlayer,
    toggleCategory,
    toggleLevel,
    deal,
  };
}

async function persistSetup(setup: Setup): Promise<void> {
  try {
    await saveSetup(storage, setup);
  } catch (error: unknown) {
    console.error("imposter: failed to persist setup", error);
  }
}

async function persistRecents(recents: readonly string[]): Promise<void> {
  try {
    await saveRecents(storage, recents);
  } catch (error: unknown) {
    console.error("imposter: failed to persist recent words", error);
  }
}
