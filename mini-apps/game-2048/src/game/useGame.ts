import { mini } from "@openmini/runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  move,
  newGame,
  settle,
  type Direction,
  type GameState,
} from "./logic.js";
import {
  BEST_KEY,
  SAVE_KEY,
  deserializeGame,
  parseBest,
  serializeGame,
} from "./save.js";

/** Slide transition length; merge leftovers are cleaned up right after. */
const SETTLE_DELAY_MS = 130;

interface UseGame {
  state: GameState;
  dispatch: (dir: Direction) => void;
  restart: () => void;
  continueGame: () => void;
}

export function useGame(): UseGame {
  const [state, setState] = useState<GameState>(() => newGame(0));
  // Persisting before hydration finishes would overwrite the stored game
  // with the placeholder one, so writes stay off until the load resolves.
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const hydratedRef = useRef(hydrated);
  hydratedRef.current = hydrated;
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate best score and any in-progress game from host storage.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([mini.storage.get(SAVE_KEY), mini.storage.get(BEST_KEY)])
      .then(([savedGame, savedBest]) => {
        if (cancelled) return;
        const best = parseBest(savedBest);
        const restored = deserializeGame(savedGame, best);
        setState(
          restored && restored.status !== "over" ? restored : newGame(best),
        );
        setHydrated(true);
      })
      .catch((error: unknown) => {
        console.error("2048: failed to load saved game", error);
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after every change, and flush on host-driven teardown.
  useEffect(() => {
    if (!hydrated) return;
    void persist(state);
  }, [state, hydrated]);
  useEffect(() => {
    const flush = () => {
      if (hydratedRef.current) void persist(stateRef.current);
    };
    const offDestroy = mini.lifecycle.onDestroy(flush);
    const offHide = mini.lifecycle.onHide(flush);
    return () => {
      offDestroy();
      offHide();
    };
  }, []);

  const scheduleSettle = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setState(settle), SETTLE_DELAY_MS);
  }, []);

  const dispatch = useCallback(
    (dir: Direction) => {
      setState((current) => {
        if (current.status === "won" || current.status === "over") {
          return current;
        }
        return move(current, dir);
      });
      scheduleSettle();
    },
    [scheduleSettle],
  );

  const restart = useCallback(() => {
    setState((current) => newGame(current.best));
  }, []);

  const continueGame = useCallback(() => {
    setState((current) =>
      current.status === "won"
        ? { ...current, status: "playing", keepPlaying: true }
        : current,
    );
  }, []);

  // Arrow keys / WASD for desktop hosts and the dev mock.
  useEffect(() => {
    const keys: Record<string, Direction> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right",
    };
    function onKeyDown(event: KeyboardEvent) {
      const dir = keys[event.key];
      if (!dir) return;
      event.preventDefault();
      dispatch(dir);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch]);

  return { state, dispatch, restart, continueGame };
}

async function persist(state: GameState): Promise<void> {
  try {
    await Promise.all([
      mini.storage.set(SAVE_KEY, serializeGame(state)),
      mini.storage.set(BEST_KEY, String(state.best)),
    ]);
  } catch (error: unknown) {
    console.error("2048: failed to persist game", error);
  }
}
