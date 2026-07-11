import { mini } from "@openmini/runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { newGame, tick, turn, type Direction, type GameState } from "./logic.js";

const BEST_KEY = "snake:best";
/** Tick interval shrinks as the snake eats, down to a floor. */
const START_MS = 220;
const MIN_MS = 90;
const STEP_MS = 6;

interface UseSnake {
  state: GameState;
  steer: (dir: Direction) => void;
  restart: () => void;
}

export function useSnake(): UseSnake {
  const [state, setState] = useState<GameState>(() => newGame(0));
  const bestRef = useRef(0);
  bestRef.current = state.best;

  useEffect(() => {
    void mini.storage
      .get(BEST_KEY)
      .then((raw) => {
        const best = raw === null ? Number.NaN : Number(raw);
        if (Number.isFinite(best) && best > 0) {
          setState((s) => ({ ...s, best: Math.max(s.best, best) }));
        }
      })
      .catch((error: unknown) => {
        console.error("snake: failed to load best score", error);
      });
  }, []);

  // Persist best on change and on host teardown.
  useEffect(() => {
    if (state.best > 0) {
      mini.storage.set(BEST_KEY, String(state.best)).catch((error: unknown) => {
        console.error("snake: failed to save best score", error);
      });
    }
  }, [state.best]);
  useEffect(() => {
    const off = mini.lifecycle.onDestroy(() => {
      void mini.storage.set(BEST_KEY, String(bestRef.current)).catch(() => {});
    });
    return off;
  }, []);

  // Game clock: speeds up with the score.
  useEffect(() => {
    if (state.status !== "playing") return;
    const delay = Math.max(MIN_MS, START_MS - state.score * STEP_MS);
    const timer = setInterval(() => setState((s) => tick(s)), delay);
    return () => clearInterval(timer);
  }, [state.status, state.score]);

  const steer = useCallback((dir: Direction) => {
    setState((s) => turn(s, dir));
  }, []);

  const restart = useCallback(() => {
    setState((s) => newGame(s.best));
  }, []);

  useEffect(() => {
    const keys: Record<string, Direction> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    function onKeyDown(event: KeyboardEvent) {
      const dir = keys[event.key];
      if (!dir) return;
      event.preventDefault();
      steer(dir);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [steer]);

  return { state, steer, restart };
}
