import { useCallback, useRef, useState, type TouchEvent } from "react";

/** How far the finger has to drag past the top before a release refreshes. */
export const PULL_THRESHOLD_PX = 72;
const MAX_PULL_PX = 110;
/** Finger travel is halved so the sheet feels weighted rather than glued. */
const PULL_RESISTANCE = 0.5;

interface PullToRefresh {
  /** Current pull distance in px, 0 when idle. Drives the spacer height. */
  pull: number;
  /** True once the pull has passed the threshold and a release will refresh. */
  armed: boolean;
  handlers: {
    onTouchStart: (event: TouchEvent<HTMLElement>) => void;
    onTouchMove: (event: TouchEvent<HTMLElement>) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
  };
}

/**
 * Pull-to-refresh for a scrolling container, on touch events since the app
 * runs in a phone WebView. A pull only starts when the container is scrolled
 * to the very top, so normal scrolling is never mistaken for one.
 */
export function usePullToRefresh(onRefresh: () => void): PullToRefresh {
  const [pull, setPull] = useState(0);
  const startY = useRef<number | null>(null);

  const onTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    startY.current =
      event.currentTarget.scrollTop <= 0 && touch !== undefined
        ? touch.clientY
        : null;
  }, []);

  const onTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    if (startY.current === null || touch === undefined) return;
    const travel = (touch.clientY - startY.current) * PULL_RESISTANCE;
    setPull(Math.min(Math.max(travel, 0), MAX_PULL_PX));
  }, []);

  const finish = useCallback(
    (release: boolean) => {
      if (release && pull >= PULL_THRESHOLD_PX) onRefresh();
      startY.current = null;
      setPull(0);
    },
    [pull, onRefresh],
  );

  return {
    pull,
    armed: pull >= PULL_THRESHOLD_PX,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd: () => finish(true),
      onTouchCancel: () => finish(false),
    },
  };
}
