import type { CSSProperties } from "react";
import { GRID_SIZE, type Direction, type GameState } from "../game/logic.js";
import { useSwipe } from "../hooks/useSwipe.js";

interface BoardProps {
  state: GameState;
  onSwipe: (dir: Direction) => void;
  onRestart: () => void;
  onContinue: () => void;
}

const CELLS = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => i);

function tileClass(tile: {
  value: number;
  spawned?: boolean;
  merged?: boolean;
  dying?: boolean;
}): string {
  return [
    "tile",
    `tile-${Math.min(tile.value, 4096)}`,
    tile.spawned ? "tile-spawned" : "",
    tile.merged ? "tile-merged" : "",
    tile.dying ? "tile-dying" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function Board({ state, onSwipe, onRestart, onContinue }: BoardProps) {
  const swipe = useSwipe(onSwipe);

  return (
    <div className="board" {...swipe}>
      {CELLS.map((i) => (
        <div key={i} className="cell" />
      ))}
      {state.tiles.map((tile) => (
        <div
          key={tile.id}
          className={tileClass(tile)}
          style={{ "--row": tile.row, "--col": tile.col } as CSSProperties}
        >
          {tile.value}
        </div>
      ))}
      {state.status !== "playing" && (
        <div className="overlay">
          <p className="overlay-title">
            {state.status === "won" ? "You win! 🎉" : "Game over"}
          </p>
          <div className="overlay-actions">
            {state.status === "won" && (
              <button type="button" className="btn" onClick={onContinue}>
                Keep going
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={onRestart}
            >
              New game
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
