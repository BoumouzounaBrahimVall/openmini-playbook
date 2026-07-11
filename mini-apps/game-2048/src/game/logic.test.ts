import { beforeEach, describe, expect, it } from "vitest";
import {
  canMove,
  move,
  newGame,
  resetTileIds,
  settle,
  type GameState,
  type Tile,
} from "./logic.js";

/** Deterministic random: always picks the first empty cell and spawns a 2. */
const firstCell = () => 0;

let idCounter = 1000;

function tile(value: number, row: number, col: number): Tile {
  return { id: idCounter++, value, row, col };
}

function tilesOf(values: number[][]): Tile[] {
  const tiles: Tile[] = [];
  values.forEach((rowValues, row) =>
    rowValues.forEach((value, col) => {
      if (value > 0) tiles.push(tile(value, row, col));
    }),
  );
  return tiles;
}

function stateOf(tiles: Tile[], score = 0): GameState {
  return { tiles, score, best: 0, status: "playing", keepPlaying: false };
}

function liveAt(state: GameState, row: number, col: number): Tile | undefined {
  return state.tiles.find((t) => !t.dying && t.row === row && t.col === col);
}

beforeEach(() => {
  resetTileIds();
  idCounter = 1000;
});

describe("newGame", () => {
  it("starts with two tiles, zero score, playing status", () => {
    const state = newGame(42, firstCell);
    expect(state.tiles).toHaveLength(2);
    expect(state.score).toBe(0);
    expect(state.best).toBe(42);
    expect(state.status).toBe("playing");
  });
});

describe("move", () => {
  it("slides a tile all the way left", () => {
    const state = move(stateOf([tile(2, 0, 3)]), "left", firstCell);
    expect(liveAt(state, 0, 0)?.value).toBe(2);
  });

  it("merges equal tiles and scores the merged value", () => {
    const state = move(
      stateOf([tile(2, 0, 0), tile(2, 0, 3)]),
      "left",
      firstCell,
    );
    expect(liveAt(state, 0, 0)?.value).toBe(4);
    expect(state.score).toBe(4);
  });

  it("does not double-merge: 2 2 2 2 → 4 4", () => {
    const state = move(
      stateOf(tilesOf([[2, 2, 2, 2]])),
      "left",
      firstCell,
    );
    expect(liveAt(state, 0, 0)?.value).toBe(4);
    expect(liveAt(state, 0, 1)?.value).toBe(4);
    expect(state.score).toBe(8);
  });

  it("merges toward the movement edge: 2 2 2 → 4 2 on left", () => {
    const state = move(
      stateOf(tilesOf([[2, 2, 2, 0]])),
      "left",
      firstCell,
    );
    expect(liveAt(state, 0, 0)?.value).toBe(4);
    expect(liveAt(state, 0, 1)?.value).toBe(2);
  });

  it("spawns exactly one tile after a moving move", () => {
    const state = move(stateOf([tile(2, 0, 3)]), "left", firstCell);
    expect(state.tiles.filter((t) => !t.dying)).toHaveLength(2);
    expect(state.tiles.some((t) => t.spawned)).toBe(true);
  });

  it("is a no-op when nothing can slide", () => {
    const before = stateOf([tile(2, 0, 0), tile(4, 0, 1)]);
    const after = move(before, "left", firstCell);
    expect(after.tiles.filter((t) => !t.dying)).toHaveLength(2);
    expect(after.score).toBe(0);
  });

  it("moves in all four directions", () => {
    expect(liveAt(move(stateOf([tile(2, 1, 1)]), "up", firstCell), 0, 1)).toBeDefined();
    expect(liveAt(move(stateOf([tile(2, 1, 1)]), "down", firstCell), 3, 1)).toBeDefined();
    expect(liveAt(move(stateOf([tile(2, 1, 1)]), "right", firstCell), 1, 3)).toBeDefined();
  });

  it("updates best when score passes it", () => {
    const state = move(
      stateOf([tile(2, 0, 0), tile(2, 0, 3)]),
      "left",
      firstCell,
    );
    expect(state.best).toBe(4);
  });

  it("flags a win when 2048 is built", () => {
    const state = move(
      stateOf([tile(1024, 0, 0), tile(1024, 0, 3)]),
      "left",
      firstCell,
    );
    expect(state.status).toBe("won");
  });

  it("keeps playing past 2048 when keepPlaying is set", () => {
    const before = {
      ...stateOf([tile(2048, 0, 0), tile(2, 0, 3)]),
      keepPlaying: true,
    };
    const state = move(before, "left", firstCell);
    expect(state.status).toBe("playing");
  });

  it("does not mutate the previous state", () => {
    const before = stateOf([tile(2, 0, 3)]);
    const snapshot = JSON.stringify(before);
    move(before, "left", firstCell);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe("settle", () => {
  it("removes dying tiles and clears animation flags", () => {
    const merged = move(
      stateOf([tile(2, 0, 0), tile(2, 0, 3)]),
      "left",
      firstCell,
    );
    const settled = settle(merged);
    expect(settled.tiles.some((t) => t.dying || t.merged || t.spawned)).toBe(
      false,
    );
    expect(settled.tiles).toHaveLength(2);
  });
});

describe("canMove / game over", () => {
  it("detects a dead board", () => {
    const dead = tilesOf([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);
    expect(canMove(dead)).toBe(false);
  });

  it("sees a move when equal neighbours exist on a full board", () => {
    const full = tilesOf([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 4],
    ]);
    expect(canMove(full)).toBe(true);
  });

  it("marks the game over when the spawn locks the board", () => {
    // Rows 0-2 are full and inert; row 3 slides right, the spawned 2 lands
    // at (3,0) and the resulting grid has no empty cell and no equal pair.
    const before = tilesOf([
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [8, 16, 8, 0],
    ]);
    const state = move(stateOf(before), "right", firstCell);
    expect(liveAt(state, 3, 0)?.value).toBe(2);
    expect(state.status).toBe("over");
  });
});
