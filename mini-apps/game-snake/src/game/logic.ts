export type Direction = "up" | "down" | "left" | "right";

export type GameStatus = "playing" | "over";

export interface Point {
  x: number;
  y: number;
}

export interface GameState {
  /** Head first. */
  snake: Point[];
  dir: Direction;
  /** Latest turn request, applied on the next tick (prevents double-turn suicides). */
  nextDir: Direction;
  food: Point;
  score: number;
  best: number;
  status: GameStatus;
}

export const GRID_SIZE = 15;

export type Random = () => number;

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function spawnFood(snake: readonly Point[], random: Random): Point {
  const free: Point[] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
    }
  }
  return free[Math.floor(random() * free.length)] ?? { x: 0, y: 0 };
}

export function newGame(best: number, random: Random = Math.random): GameState {
  const mid = Math.floor(GRID_SIZE / 2);
  const snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  return {
    snake,
    dir: "right",
    nextDir: "right",
    food: spawnFood(snake, random),
    score: 0,
    best,
    status: "playing",
  };
}

/** Queue a turn; reversing into yourself is ignored. */
export function turn(state: GameState, dir: Direction): GameState {
  if (state.status !== "playing" || dir === OPPOSITE[state.dir]) return state;
  return { ...state, nextDir: dir };
}

/** Advance one step: move, eat, or die (walls and self are fatal). */
export function tick(state: GameState, random: Random = Math.random): GameState {
  if (state.status !== "playing") return state;

  const dir = state.nextDir;
  const head = state.snake[0];
  const next = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };

  const eats = samePoint(next, state.food);
  // The tail cell frees up this tick unless the snake grows into it.
  const body = eats ? state.snake : state.snake.slice(0, -1);
  const hitsWall =
    next.x < 0 || next.y < 0 || next.x >= GRID_SIZE || next.y >= GRID_SIZE;
  if (hitsWall || body.some((s) => samePoint(s, next))) {
    return { ...state, dir, status: "over" };
  }

  const snake = [next, ...body];
  const score = eats ? state.score + 1 : state.score;
  return {
    ...state,
    snake,
    dir,
    nextDir: dir,
    food: eats ? spawnFood(snake, random) : state.food,
    score,
    best: Math.max(state.best, score),
  };
}
