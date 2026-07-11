import { describe, expect, it } from "vitest";
import {
  GRID_SIZE,
  newGame,
  spawnFood,
  tick,
  turn,
  type GameState,
} from "./logic.js";

const firstFree = () => 0;

function playing(overrides: Partial<GameState>): GameState {
  return { ...newGame(0, firstFree), ...overrides };
}

describe("newGame", () => {
  it("starts a 3-long snake moving right with food placed", () => {
    const state = newGame(7, firstFree);
    expect(state.snake).toHaveLength(3);
    expect(state.dir).toBe("right");
    expect(state.best).toBe(7);
    expect(state.status).toBe("playing");
    expect(state.snake.some((s) => s.x === state.food.x && s.y === state.food.y)).toBe(false);
  });
});

describe("tick", () => {
  it("moves the head one cell and drops the tail", () => {
    const before = newGame(0, firstFree);
    const after = tick(before, firstFree);
    expect(after.snake[0]).toEqual({ x: before.snake[0].x + 1, y: before.snake[0].y });
    expect(after.snake).toHaveLength(3);
  });

  it("grows and scores when eating food", () => {
    const head = { x: 3, y: 3 };
    const state = playing({
      snake: [head, { x: 2, y: 3 }, { x: 1, y: 3 }],
      food: { x: 4, y: 3 },
    });
    const after = tick(state, firstFree);
    expect(after.snake).toHaveLength(4);
    expect(after.score).toBe(1);
    expect(after.best).toBe(1);
    expect(after.food).not.toEqual({ x: 4, y: 3 });
  });

  it("dies on the wall", () => {
    const state = playing({
      snake: [{ x: GRID_SIZE - 1, y: 5 }, { x: GRID_SIZE - 2, y: 5 }],
    });
    expect(tick(state, firstFree).status).toBe("over");
  });

  it("dies on its own body", () => {
    // Head at (2,2) turning down into a body loop.
    const state = playing({
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
        { x: 1, y: 3 },
        { x: 2, y: 3 },
        { x: 3, y: 3 },
      ],
      dir: "right",
      nextDir: "down",
      food: { x: 9, y: 9 },
    });
    expect(tick(state, firstFree).status).toBe("over");
  });

  it("may move into the cell its tail just vacated", () => {
    const state = playing({
      snake: [
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 2 },
      ],
      dir: "up",
      nextDir: "right",
      food: { x: 9, y: 9 },
    });
    expect(tick(state, firstFree).status).toBe("playing");
  });
});

describe("turn", () => {
  it("queues a perpendicular turn", () => {
    expect(turn(newGame(0, firstFree), "up").nextDir).toBe("up");
  });
  it("ignores reversing into yourself", () => {
    expect(turn(newGame(0, firstFree), "left").nextDir).toBe("right");
  });
  it("does not mutate the input", () => {
    const state = newGame(0, firstFree);
    const snapshot = JSON.stringify(state);
    turn(state, "up");
    tick(state, firstFree);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe("spawnFood", () => {
  it("never lands on the snake", () => {
    const snake = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    const food = spawnFood(snake, firstFree);
    expect(snake.some((s) => s.x === food.x && s.y === food.y)).toBe(false);
  });
});
