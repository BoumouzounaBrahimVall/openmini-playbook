import { mini } from "@openmini/runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  PHASE_LABEL,
  initialState,
  pause,
  reset,
  skip,
  start,
  tick,
  type TimerState,
} from "./logic.js";

const STATS_KEY = "pomodoro:stats";
const TICK_MS = 250;

interface UseTimer {
  state: TimerState;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSkip: () => void;
}

function parseStats(raw: string | null): number {
  if (raw === null) return 0;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).completed === "number" &&
      (parsed as { completed: number }).completed >= 0
    ) {
      return (parsed as { completed: number }).completed;
    }
  } catch {
    // fall through to 0 on corrupt data
  }
  return 0;
}

export function useTimer(): UseTimer {
  const [state, setState] = useState<TimerState>(() => initialState());
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const hydratedRef = useRef(hydrated);
  hydratedRef.current = hydrated;
  const lastTickRef = useRef<number | null>(null);

  // Restore the all-time completed-sessions count.
  useEffect(() => {
    let cancelled = false;
    void mini.storage
      .get(STATS_KEY)
      .then((raw) => {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          completedFocus: parseStats(raw),
        }));
        setHydrated(true);
      })
      .catch((error: unknown) => {
        console.error("pomodoro: failed to load stats", error);
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after hydration, and flush when the host hides/destroys the app.
  useEffect(() => {
    if (!hydrated) return;
    void persist(state.completedFocus);
  }, [state.completedFocus, hydrated]);
  useEffect(() => {
    const flush = () => {
      if (hydratedRef.current) void persist(stateRef.current.completedFocus);
    };
    const offDestroy = mini.lifecycle.onDestroy(flush);
    const offHide = mini.lifecycle.onHide(flush);
    return () => {
      offDestroy();
      offHide();
    };
  }, []);

  // Wall-clock driven ticking — accurate even when intervals are throttled.
  useEffect(() => {
    if (!state.running) {
      lastTickRef.current = null;
      return;
    }
    lastTickRef.current = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - (lastTickRef.current ?? now);
      lastTickRef.current = now;
      setState((current) => {
        const result = tick(current, elapsed);
        if (result.ended) {
          void mini.ui
            .showToast({
              message: `${PHASE_LABEL[result.ended]} done — ${PHASE_LABEL[result.state.phase]} time!`,
              durationMs: 2500,
            })
            .catch((error: unknown) =>
              console.error("pomodoro: toast failed", error),
            );
        }
        return result.state;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [state.running]);

  return {
    state,
    onStart: useCallback(() => setState(start), []),
    onPause: useCallback(() => setState(pause), []),
    onReset: useCallback(() => setState(reset), []),
    onSkip: useCallback(() => setState(skip), []),
  };
}

async function persist(completed: number): Promise<void> {
  try {
    await mini.storage.set(STATS_KEY, JSON.stringify({ completed }));
  } catch (error: unknown) {
    console.error("pomodoro: failed to persist stats", error);
  }
}
