import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchWindow } from "./fetchWindow.js";
import {
  dayWindows,
  rankFeed,
  type DayWindow,
  type Feed,
  type Story,
} from "./feed.js";

export type WindowState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; stories: readonly Story[] };

interface UseFeed {
  windows: readonly DayWindow[];
  selected: DayWindow;
  select: (daysAgo: number) => void;
  state: WindowState;
  feed: Feed;
  retry: () => void;
}

const LOADING: WindowState = { status: "loading" };

/**
 * One request per day window, cached in memory for the session so stepping
 * back and forth is instant. `anchor` is fixed at launch so the chips never
 * shift under a thumb. The cache is a map rebuilt on every write rather
 * than mutated, so React sees each change.
 */
export function useFeed(anchor: number, keywords: readonly string[]): UseFeed {
  const windows = useMemo(() => dayWindows(anchor), [anchor]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [cache, setCache] = useState<ReadonlyMap<number, WindowState>>(
    () => new Map(),
  );

  // Windows with a request in flight. A ref rather than the cache, because an
  // effect re-run (StrictMode, a fast double tap on Retry) sees the cache from
  // the render that scheduled it, not the write it made itself.
  const inFlight = useRef<ReadonlySet<number>>(new Set());

  const selected = windows[selectedDay];
  const state = cache.get(selectedDay) ?? LOADING;

  const load = useCallback((window: DayWindow) => {
    if (inFlight.current.has(window.daysAgo)) return;
    inFlight.current = new Set([...inFlight.current, window.daysAgo]);
    setCache((current) => withEntry(current, window.daysAgo, LOADING));
    void fetchWindow(window).then((result) => {
      const next: WindowState = result.ok
        ? { status: "ready", stories: result.stories }
        : { status: "error", message: result.message };
      inFlight.current = new Set(
        [...inFlight.current].filter((day) => day !== window.daysAgo),
      );
      setCache((current) => withEntry(current, window.daysAgo, next));
    });
  }, []);

  // A window is fetched the first time it is shown, and only then.
  useEffect(() => {
    if (cache.has(selectedDay)) return;
    load(selected);
  }, [cache, selectedDay, selected, load]);

  const retry = useCallback(() => load(selected), [load, selected]);

  const feed = useMemo(
    () =>
      rankFeed(state.status === "ready" ? state.stories : [], keywords, selected),
    [state, keywords, selected],
  );

  return {
    windows,
    selected,
    select: setSelectedDay,
    state,
    feed,
    retry,
  };
}

function withEntry(
  cache: ReadonlyMap<number, WindowState>,
  key: number,
  value: WindowState,
): ReadonlyMap<number, WindowState> {
  return new Map([...cache, [key, value]]);
}
