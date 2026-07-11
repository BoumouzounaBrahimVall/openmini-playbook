import { describe, expect, it } from "vitest";
import type { GameState, Tile } from "./logic.js";
import { deserializeGame, parseBest, serializeGame } from "./save.js";

function stateOf(tiles: Tile[], score = 0): GameState {
  return { tiles, score, best: 0, status: "playing", keepPlaying: false };
}

describe("serialize / deserialize round-trip", () => {
  it("restores tiles, score and keepPlaying", () => {
    const state: GameState = {
      ...stateOf(
        [
          { id: 1, value: 2, row: 0, col: 3 },
          { id: 2, value: 4, row: 2, col: 1 },
        ],
        24,
      ),
      keepPlaying: true,
    };
    const restored = deserializeGame(serializeGame(state), 100);
    expect(restored).not.toBeNull();
    expect(restored?.tiles).toHaveLength(2);
    expect(restored?.score).toBe(24);
    expect(restored?.keepPlaying).toBe(true);
    expect(restored?.best).toBe(100);
    expect(restored?.status).toBe("playing");
  });

  it("drops dying tiles and animation flags when saving", () => {
    const state = stateOf([
      { id: 1, value: 4, row: 0, col: 0, merged: true },
      { id: 2, value: 2, row: 0, col: 0, dying: true },
    ]);
    const restored = deserializeGame(serializeGame(state), 0);
    expect(restored?.tiles).toHaveLength(1);
    expect(restored?.tiles[0]).toEqual({ id: 1, value: 4, row: 0, col: 0 });
  });

  it("raises best to the saved score", () => {
    const state = stateOf([{ id: 1, value: 2, row: 0, col: 0 }], 500);
    expect(deserializeGame(serializeGame(state), 10)?.best).toBe(500);
  });
});

describe("deserializeGame rejects corrupt input", () => {
  const cases: Array<[string, string | null]> = [
    ["missing value", null],
    ["not json", "{oops"],
    ["not an object", '"hi"'],
    ["empty tiles", '{"tiles":[],"score":0}'],
    [
      "negative score",
      '{"tiles":[{"id":1,"value":2,"row":0,"col":0}],"score":-1}',
    ],
    [
      "out-of-grid tile",
      '{"tiles":[{"id":1,"value":2,"row":9,"col":0}],"score":0}',
    ],
    [
      "non-numeric value",
      '{"tiles":[{"id":1,"value":"2","row":0,"col":0}],"score":0}',
    ],
    [
      "overlapping tiles",
      '{"tiles":[{"id":1,"value":2,"row":0,"col":0},{"id":2,"value":4,"row":0,"col":0}],"score":0}',
    ],
  ];
  it.each(cases)("%s → null", (_name, raw) => {
    expect(deserializeGame(raw, 0)).toBeNull();
  });
});

describe("parseBest", () => {
  it("parses a stored number", () => {
    expect(parseBest("512")).toBe(512);
  });
  it("falls back to 0 for garbage", () => {
    expect(parseBest(null)).toBe(0);
    expect(parseBest("nope")).toBe(0);
    expect(parseBest("-4")).toBe(0);
  });
});
