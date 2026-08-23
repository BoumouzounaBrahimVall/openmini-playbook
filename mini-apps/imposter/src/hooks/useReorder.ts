import { useCallback, useRef, useState } from "react";
import type { CSSProperties } from "react";

interface Reorder {
  /** Index of the row in hand, or null when nothing is being dragged. */
  dragIndex: number | null;
  /** Inline transform for the row at `index` — drives all of the motion. */
  rowStyle: (index: number) => CSSProperties;
  /** 1-based seat the row at `index` currently *appears* to occupy. */
  seatNumber: (index: number) => number;
  /** Spread onto the drag handle of the row at `index`. */
  handleProps: (index: number) => {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  };
}

/**
 * Drag-to-reorder for a vertical list, on pointer events rather than HTML5
 * drag-and-drop — `dragstart` never fires from a touch, and this runs on a
 * phone.
 *
 * The list is NOT reordered while the finger is down. Instead the row in hand
 * follows the pointer, and the rows it displaces slide out of its way by one
 * row height each; the actual move is committed once, on release. Reordering
 * the data live instead would be cheaper, but there is then nothing on screen
 * that moves continuously, so a drag reads as an unexplained jump — the list
 * changes without ever having shown the change happening.
 *
 * Arrow keys on the handle move a row immediately. A drag-only affordance is
 * unusable without a pointer, and the handle is already focusable.
 */
export function useReorder(
  length: number,
  onMove: (from: number, to: number) => void,
): Reorder {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const startY = useRef(0);
  const rowHeight = useRef(48);
  const indexRef = useRef<number | null>(null);

  /** Where the dragged row would land if released now. */
  const previewIndex =
    dragIndex === null
      ? null
      : Math.min(
          length - 1,
          Math.max(0, dragIndex + Math.round(offset / rowHeight.current)),
        );

  /**
   * How far the row at `index` has been displaced, in whole rows. The dragged
   * row is handled separately: it tracks the pointer, not the grid.
   */
  const shiftOf = useCallback(
    (index: number): number => {
      if (dragIndex === null || previewIndex === null) return 0;
      if (index === dragIndex) return 0;
      if (dragIndex < previewIndex && index > dragIndex && index <= previewIndex) {
        return -1;
      }
      if (dragIndex > previewIndex && index < dragIndex && index >= previewIndex) {
        return 1;
      }
      return 0;
    },
    [dragIndex, previewIndex],
  );

  const rowStyle = useCallback(
    (index: number): CSSProperties => {
      if (index === dragIndex) {
        return {
          transform: `translateY(${String(offset)}px) scale(1.02)`,
          // No easing on the held row: it must sit under the finger exactly.
          transition: "none",
          zIndex: 2,
        };
      }
      const shift = shiftOf(index);
      if (shift === 0) return {};
      return { transform: `translateY(${String(shift * rowHeight.current)}px)` };
    },
    [dragIndex, offset, shiftOf],
  );

  const seatNumber = useCallback(
    (index: number): number => {
      if (dragIndex === null || previewIndex === null) return index + 1;
      if (index === dragIndex) return previewIndex + 1;
      return index + shiftOf(index) + 1;
    },
    [dragIndex, previewIndex, shiftOf],
  );

  const finish = useCallback(
    (commit: boolean) => {
      const from = indexRef.current;
      if (commit && from !== null) {
        const to = Math.min(
          length - 1,
          Math.max(0, from + Math.round(offset / rowHeight.current)),
        );
        if (to !== from) onMove(from, to);
      }
      indexRef.current = null;
      setDragIndex(null);
      setOffset(0);
    },
    [length, offset, onMove],
  );

  const handleProps = useCallback(
    (index: number) => ({
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        const row = event.currentTarget.closest("li");
        if (row) {
          const style = window.getComputedStyle(row);
          const gap = Number.parseFloat(style.marginBottom) || 6;
          rowHeight.current = row.getBoundingClientRect().height + gap;
        }
        startY.current = event.clientY;
        indexRef.current = index;
        setDragIndex(index);
        setOffset(0);
        // Keep receiving moves once the finger leaves the handle.
        event.currentTarget.setPointerCapture(event.pointerId);
      },

      onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
        if (indexRef.current === null) return;
        setOffset(event.clientY - startY.current);
      },

      onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        finish(true);
      },

      // A cancelled pointer is not a decision, so the row goes back.
      onPointerCancel: () => {
        finish(false);
      },

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
    [finish, length, onMove],
  );

  return { dragIndex, rowStyle, seatNumber, handleProps };
}
