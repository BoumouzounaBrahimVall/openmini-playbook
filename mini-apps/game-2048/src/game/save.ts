import {
  GRID_SIZE,
  WIN_VALUE,
  canMove,
  type GameState,
  type Tile,
} from "./logic.js";

export const SAVE_KEY = "game2048:save";
export const BEST_KEY = "game2048:best";

interface SavedGame {
  tiles: Tile[];
  score: number;
  keepPlaying: boolean;
}

export function serializeGame(state: GameState): string {
  const tiles = state.tiles
    .filter((t) => !t.dying)
    .map(({ id, value, row, col }) => ({ id, value, row, col }));
  const saved: SavedGame = {
    tiles,
    score: state.score,
    keepPlaying: state.keepPlaying,
  };
  return JSON.stringify(saved);
}

function isValidTile(t: unknown): t is Tile {
  if (typeof t !== "object" || t === null) return false;
  const tile = t as Record<string, unknown>;
  return (
    typeof tile.id === "number" &&
    typeof tile.value === "number" &&
    Number.isInteger(tile.value) &&
    (tile.value as number) >= 2 &&
    Number.isInteger(tile.row) &&
    Number.isInteger(tile.col) &&
    (tile.row as number) >= 0 &&
    (tile.row as number) < GRID_SIZE &&
    (tile.col as number) >= 0 &&
    (tile.col as number) < GRID_SIZE
  );
}

/** Rebuild a GameState from a stored string; null if missing or corrupt. */
export function deserializeGame(
  raw: string | null,
  best: number,
): GameState | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const saved = parsed as Record<string, unknown>;
  if (
    !Array.isArray(saved.tiles) ||
    saved.tiles.length === 0 ||
    !saved.tiles.every(isValidTile) ||
    typeof saved.score !== "number" ||
    saved.score < 0
  ) {
    return null;
  }
  const tiles = saved.tiles as Tile[];
  const seen = new Set(tiles.map((t) => `${t.row},${t.col}`));
  if (seen.size !== tiles.length) return null;

  const keepPlaying = saved.keepPlaying === true;
  const reachedWin = tiles.some((t) => t.value >= WIN_VALUE);
  const status = !canMove(tiles)
    ? "over"
    : reachedWin && !keepPlaying
      ? "won"
      : "playing";
  return {
    tiles,
    score: saved.score,
    best: Math.max(best, saved.score),
    status,
    keepPlaying,
  };
}

export function parseBest(raw: string | null): number {
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
