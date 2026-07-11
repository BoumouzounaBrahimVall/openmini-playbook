import { useRef, type PointerEvent } from "react";
import type { Direction } from "../game/logic.js";

const MIN_SWIPE_PX = 24;

interface SwipeHandlers {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
}

/** Pointer-based swipe detection — covers touch on device and mouse drags in the dev mock. */
export function useSwipe(onSwipe: (dir: Direction) => void): SwipeHandlers {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onPointerDown(event) {
      start.current = { x: event.clientX, y: event.clientY };
    },
    onPointerUp(event) {
      if (!start.current) return;
      const dx = event.clientX - start.current.x;
      const dy = event.clientY - start.current.y;
      start.current = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < MIN_SWIPE_PX) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        onSwipe(dx > 0 ? "right" : "left");
      } else {
        onSwipe(dy > 0 ? "down" : "up");
      }
    },
    onPointerCancel() {
      start.current = null;
    },
  };
}
