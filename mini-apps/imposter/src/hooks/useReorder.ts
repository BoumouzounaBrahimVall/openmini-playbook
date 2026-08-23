import { useCallback, useRef, useState } from "react";

interface Reorder {
  /** Index currently being dragged, or null when nothing is in hand. */
  dragIndex: number | null;
  /** Spread onto the drag handle of the row at `index`. */
  handleProps: (index: number) => {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  };
}

/**
 * Drag-to-reorder for a vertical list, on pointer events rather than HTML5
 * drag-and-drop — `dragstart` never fires from a touch, and this runs on a
 * phone.
 *
 * The move is committed as soon as the finger crosses the neighbouring row's
 * midpoint, rather than being previewed and applied on release. That keeps the
 * list in its real order at all times, so there is no separate "where would
 * this land" model to render or to get out of step with the data.
 *
 * Arrow keys on the handle move the row too. A drag-only affordance is
 * unusable without a pointer, and the handle is already focusable.
 */
export function useReorder(
  length: number,
  onMove: (from: number, to: number) => void,
): Reorder {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Pointer Y that the current row position was measured from; it is re-based
  // by one row every time a move commits, so held drags keep tracking.
  const originY = useRef(0);
  const rowHeight = useRef(48);
  const indexRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    indexRef.current = null;
    setDragIndex(null);
  }, []);

  const handleProps = useCallback(
    (index: number) => ({
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        const row = event.currentTarget.closest("li");
        if (row) rowHeight.current = row.getBoundingClientRect().height + 6;
        originY.current = event.clientY;
        indexRef.current = index;
        setDragIndex(index);
        // Keep receiving moves even when the finger leaves the handle.
        event.currentTarget.setPointerCapture(event.pointerId);
      },

      onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
        const from = indexRef.current;
        if (from === null) return;
        const dy = event.clientY - originY.current;
        const threshold = rowHeight.current * 0.6;
        if (dy > threshold && from < length - 1) {
          onMove(from, from + 1);
          indexRef.current = from + 1;
          setDragIndex(from + 1);
          originY.current += rowHeight.current;
        } else if (dy < -threshold && from > 0) {
          onMove(from, from - 1);
          indexRef.current = from - 1;
          setDragIndex(from - 1);
          originY.current -= rowHeight.current;
        }
      },

      onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        stop();
      },

      onPointerCancel: stop,

      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === "ArrowUp" && index > 0) {
          event.preventDefault();
          onMove(index, index - 1);
        } else if (event.key === "ArrowDown" && index < length - 1) {
          event.preventDefault();
          onMove(index, index + 1);
        }
      },
    }),
    [length, onMove, stop],
  );

  return { dragIndex, handleProps };
}
