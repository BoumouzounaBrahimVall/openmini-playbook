import type { CSSProperties } from "react";
import type { Direction, GameState } from "../game/logic.js";

interface BoardProps {
  state: GameState;
  onSteer: (dir: Direction) => void;
  onRestart: () => void;
}

function cellStyle(x: number, y: number): CSSProperties {
  return { "--x": x, "--y": y } as CSSProperties;
}

export function Board({ state, onSteer, onRestart }: BoardProps) {
  return (
    <>
      <div className="board" role="img" aria-label="Snake board">
        {state.snake.map((part, i) => (
          <div
            key={`${part.x},${part.y}`}
            className={i === 0 ? "seg head" : "seg"}
            style={cellStyle(part.x, part.y)}
          />
        ))}
        <div className="food" style={cellStyle(state.food.x, state.food.y)} />
        {state.status === "over" && (
          <div className="overlay">
            <p className="overlay-title">Game over</p>
            <p className="overlay-sub">Score {state.score}</p>
            <button type="button" className="btn btn-primary" onClick={onRestart}>
              Play again
            </button>
          </div>
        )}
      </div>
      <DPad onSteer={onSteer} />
    </>
  );
}

const ARROWS: Array<{ dir: Direction; label: string; glyph: string }> = [
  { dir: "up", label: "Up", glyph: "▲" },
  { dir: "left", label: "Left", glyph: "◀" },
  { dir: "down", label: "Down", glyph: "▼" },
  { dir: "right", label: "Right", glyph: "▶" },
];

function DPad({ onSteer }: { onSteer: (dir: Direction) => void }) {
  return (
    <div className="dpad" role="group" aria-label="Direction controls">
      {ARROWS.map(({ dir, label, glyph }) => (
        <button
          key={dir}
          type="button"
          className={`dpad-btn dpad-${dir}`}
          aria-label={label}
          onPointerDown={(e) => {
            e.preventDefault();
            onSteer(dir);
          }}
        >
          {glyph}
        </button>
      ))}
    </div>
  );
}
