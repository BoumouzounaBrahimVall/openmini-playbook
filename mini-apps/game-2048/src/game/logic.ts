export type Direction = "up" | "down" | "left" | "right";

export type GameStatus = "playing" | "won" | "over";

export interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
  /** Freshly spawned this move — pop-in animation. */
  spawned?: boolean;
  /** Created by a merge this move — pulse animation. */
  merged?: boolean;
  /** Consumed by a merge — slides to its target, then settle() removes it. */
  dying?: boolean;
}

export interface GameState {
  tiles: Tile[];
  score: number;
  best: number;
  status: GameStatus;
  /** Player chose to keep going after reaching the winning tile. */
  keepPlaying: boolean;
}

export const GRID_SIZE = 4;
export const WIN_VALUE = 2048;

export type Random = () => number;

let nextTileId = 1;

export function resetTileIds(): void {
  nextTileId = 1;
}

function liveTiles(tiles: readonly Tile[]): Tile[] {
  return tiles.filter((t) => !t.dying);
}

/** Drop merge leftovers and clear one-move animation flags. */
export function settle(state: GameState): GameState {
  const needsWork = state.tiles.some((t) => t.dying || t.spawned || t.merged);
  if (!needsWork) return state;
  return {
    ...state,
    tiles: liveTiles(state.tiles).map(({ id, value, row, col }) => ({
      id,
      value,
      row,
      col,
    })),
  };
}

function emptyCells(
  tiles: readonly Tile[],
): Array<{ row: number; col: number }> {
  const taken = new Set(liveTiles(tiles).map((t) => `${t.row},${t.col}`));
  const cells: Array<{ row: number; col: number }> = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (!taken.has(`${row},${col}`)) cells.push({ row, col });
    }
  }
  return cells;
}

function spawnTile(tiles: readonly Tile[], random: Random): Tile | null {
  const cells = emptyCells(tiles);
  if (cells.length === 0) return null;
  const cell = cells[Math.floor(random() * cells.length)];
  return {
    id: nextTileId++,
    value: random() < 0.9 ? 2 : 4,
    row: cell.row,
    col: cell.col,
    spawned: true,
  };
}

export function newGame(best: number, random: Random = Math.random): GameState {
  let tiles: Tile[] = [];
  for (let i = 0; i < 2; i++) {
    const tile = spawnTile(tiles, random);
    if (tile) tiles = [...tiles, tile];
  }
  return { tiles, score: 0, best, status: "playing", keepPlaying: false };
}

export function canMove(tiles: readonly Tile[]): boolean {
  const live = liveTiles(tiles);
  if (live.length < GRID_SIZE * GRID_SIZE) return true;
  const grid = new Map(live.map((t) => [`${t.row},${t.col}`, t.value]));
  return live.some(
    (t) =>
      grid.get(`${t.row},${t.col + 1}`) === t.value ||
      grid.get(`${t.row + 1},${t.col}`) === t.value,
  );
}

/** Cell coordinates of one line, ordered from the edge tiles slide toward. */
function lineCells(
  dir: Direction,
  line: number,
): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    const j = dir === "right" || dir === "down" ? GRID_SIZE - 1 - i : i;
    cells.push(
      dir === "left" || dir === "right"
        ? { row: line, col: j }
        : { row: j, col: line },
    );
  }
  return cells;
}

export function move(
  state: GameState,
  dir: Direction,
  random: Random = Math.random,
): GameState {
  if (state.status === "over") return state;

  const settled = settle(state);
  const grid = new Map(settled.tiles.map((t) => [`${t.row},${t.col}`, t]));

  const nextTiles: Tile[] = [];
  let gained = 0;
  let moved = false;

  for (let line = 0; line < GRID_SIZE; line++) {
    const cells = lineCells(dir, line);
    const lineTiles = cells
      .map((c) => grid.get(`${c.row},${c.col}`))
      .filter((t): t is Tile => t !== undefined);

    let slot = 0;
    let lastPlaced: Tile | null = null;

    for (const tile of lineTiles) {
      if (lastPlaced && lastPlaced.value === tile.value) {
        const target = { row: lastPlaced.row, col: lastPlaced.col };
        // Both sources slide to the target cell; a doubled tile pops in there.
        nextTiles[nextTiles.indexOf(lastPlaced)] = { ...lastPlaced, dying: true };
        nextTiles.push({ ...tile, ...target, dying: true });
        const mergedTile: Tile = {
          id: nextTileId++,
          value: tile.value * 2,
          ...target,
          merged: true,
        };
        nextTiles.push(mergedTile);
        gained += mergedTile.value;
        moved = true;
        lastPlaced = null;
      } else {
        const target = cells[slot++];
        const placed: Tile = { ...tile, ...target };
        if (placed.row !== tile.row || placed.col !== tile.col) moved = true;
        nextTiles.push(placed);
        lastPlaced = placed;
      }
    }
  }

  if (!moved) return settled;

  const spawned = spawnTile(nextTiles, random);
  const tiles = spawned ? [...nextTiles, spawned] : nextTiles;
  const score = settled.score + gained;
  const best = Math.max(settled.best, score);

  let status: GameStatus = "playing";
  const reachedWin = liveTiles(tiles).some((t) => t.value >= WIN_VALUE);
  if (reachedWin && !settled.keepPlaying) {
    status = "won";
  } else if (!canMove(tiles)) {
    status = "over";
  }

  return { ...settled, tiles, score, best, status };
}
