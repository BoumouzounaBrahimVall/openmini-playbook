import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchWindow } from "./fetchWindow.js";
import {
  dayWindows,
  filterByFocus,
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
  /** Drop the selected window's cache and fetch it again. */
  refresh: () => void;
}

const LOADING: WindowState = { status: "loading" };

/**
 * One request per day window, cached in memory for the session so stepping
 * back and forth is instant. `anchor` is fixed at launch so the chips never
 * shift under a thumb. The cache is a map rebuilt on every write rather
 * than mutated, so React sees each change.
 * `filterKey` names the current keyword set once it is known; when it changes
 * the whole cache is dropped and the selected window fetched again, so an
 * edited filter shows fresh stories, not re-sorted ones. `focus` narrows the
 * ranked window to stories on those keywords without touching the cache.
 */
export function useFeed(
  anchor: number,
  keywords: readonly string[],
  filterKey: string | null,
  focus: readonly string[],
): UseFeed {
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

  // The first key seen is the saved filter arriving, not an edit.
  const lastFilterKey = useRef<string | null>(null);
  useEffect(() => {
    if (filterKey === null || lastFilterKey.current === filterKey) return;
    const isEdit = lastFilterKey.current !== null;
    lastFilterKey.current = filterKey;
    if (!isEdit) return;
    inFlight.current = new Set();
    setCache(new Map());
  }, [filterKey]);

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

  // Deleting the entry is enough: the mount effect sees the gap and fetches.
  const refresh = useCallback(() => {
    if (inFlight.current.has(selected.daysAgo)) return;
    setCache((current) => {
      const next = new Map(current);
      next.delete(selected.daysAgo);
      return next;
    });
  }, [selected]);

  // Focus is a local view on the fetched window: no request, just a subset.
  const feed = useMemo(
    () =>
      rankFeed(
        filterByFocus(state.status === "ready" ? state.stories : [], focus),
        keywords,
        selected,
      ),
    [state, keywords, selected, focus],
  );

  return {
    windows,
    selected,
    select: setSelectedDay,
    state,
    feed,
    retry,
    refresh,
  };
}

function withEntry(
  cache: ReadonlyMap<number, WindowState>,
  key: number,
  value: WindowState,
): ReadonlyMap<number, WindowState> {
  return new Map([...cache, [key, value]]);
}
