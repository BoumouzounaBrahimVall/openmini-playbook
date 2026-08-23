import { describe, expect, it } from "vitest";
import {
  CATEGORY_IDS,
  CATEGORY_LABELS,
  type Catalog,
  type Level,
  type WordEntry,
} from "../content/types.js";
import {
  DEFAULT_SETUP,
  MAX_NAME_LENGTH,
  RECENTS_KEY,
  RECENTS_LIMIT,
  SETUP_KEY,
  loadSession,
  saveRecents,
  saveSetup,
  startRound,
  validateNewName,
  validateSetup,
  type KvStorage,
  type Random,
  type Round,
  type SetupProblem,
  type Setup,
} from "./session.js";

/** Deterministic random: always the first survivor / the first player. */
const first: Random = () => 0;

/** Deterministic random replaying fixed values, then repeating the last one. */
function sequence(...values: number[]): Random {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

/** In-memory storage fake, so no test ever mocks a global. */
interface FakeStorage extends KvStorage {
  keys(): string[];
}

function memoryStorage(seed: Record<string, string> = {}): FakeStorage {
  const cells = new Map<string, string>(Object.entries(seed));
  return {
    get: (key) => Promise.resolve(cells.get(key) ?? null),
    set: (key, value) => {
      cells.set(key, value);
      return Promise.resolve();
    },
    keys: () => [...cells.keys()],
  };
}

function entry(word: string, level: Level = 1): WordEntry {
  return { word, hint: `something about ${word.toLowerCase()}`, level };
}

/** A pool of injected fixtures; the bundled CATALOG is never used here. */
function poolOf(overrides: Partial<Catalog>): Catalog {
  return {
    foodAndDrink: [],
    animals: [],
    places: [],
    jobs: [],
    objects: [],
    ...overrides,
  };
}

function names(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Player${String(i + 1)}`);
}

function setupOf(overrides: Partial<Setup> = {}): Setup {
  return {
    roster: names(4),
    categories: ["foodAndDrink"],
    levels: [1],
    ...overrides,
  };
}

const applePool = poolOf({ foodAndDrink: [entry("Apple")] });

/** Deal a round, failing the test rather than the type checker on rejection. */
function deal(
  setup: Setup,
  recents: readonly string[] = [],
  pool: Catalog = applePool,
  random: Random = first,
): Round {
  const result = startRound(setup, recents, pool, random);
  if (!result.ok)
    throw new Error(`unexpected rejection: ${result.rejection.problem}`);
  return result.round;
}

describe("DEFAULT_SETUP", () => {
  it("starts with an empty roster, every category and level 3 opt-in", () => {
    expect(DEFAULT_SETUP.roster).toEqual([]);
    expect(DEFAULT_SETUP.categories).toEqual(CATEGORY_IDS);
    expect(DEFAULT_SETUP.levels).toEqual([1, 2]);
  });
});

describe("startRound designates exactly one imposter", () => {
  const counts: Array<[string, number]> = Array.from({ length: 10 }, (_, i) => [
    `${String(i + 3)} players`,
    i + 3,
  ]);

  it.each(counts)("%s → one imposter", (_label, count) => {
    // Imposter lands mid-roster for every count, so the assertion is not
    // satisfied by an off-by-one that always picks index 0.
    const round = deal(
      setupOf({ roster: names(count) }),
      [],
      applePool,
      sequence(0, 0.5, 0),
    );
    expect(round.imposterIndices).toHaveLength(1);
    expect(round.secrets.filter((s) => s.imposter)).toHaveLength(1);
    expect(round.secrets).toHaveLength(count);
    expect(round.imposterIndices[0]).toBe(Math.floor(0.5 * count));
  });

  it("keeps the imposter as a list so a second imposter is a draw change", () => {
    const round = deal(setupOf());
    expect(round.imposterIndices).toEqual([
      round.secrets.findIndex((s) => s.imposter),
    ]);
  });

  it("can pick the same player as imposter twice in a row", () => {
    const setup = setupOf();
    const one = deal(setup, [], applePool, sequence(0, 0, 0));
    const two = deal(setup, [], applePool, sequence(0, 0, 0));
    expect(two.imposterIndices).toEqual(one.imposterIndices);
  });
});

describe("startRound deals the secrets", () => {
  it("gives every non-imposter the identical word", () => {
    const round = deal(
      setupOf({ roster: names(6) }),
      [],
      applePool,
      sequence(0, 0.5, 0),
    );
    const crew = round.secrets.filter((s) => !s.imposter);
    expect(crew).toHaveLength(5);
    expect(new Set(crew.map((s) => s.word))).toEqual(new Set(["Apple"]));
  });

  it("gives the imposter the hint and, in no circumstance, the word", () => {
    const round = deal(
      setupOf({ roster: names(6) }),
      [],
      applePool,
      sequence(0, 0.5, 0),
    );
    const imposter = round.secrets[round.imposterIndices[0]];
    expect(imposter.imposter).toBe(true);
    expect(imposter.word).toBeNull();
    expect(imposter.hint).toBe("something about apple");
  });

  it("withholds the hint from the crew, who get the word instead", () => {
    const round = deal(setupOf());
    for (const secret of round.secrets.filter((s) => !s.imposter)) {
      expect(secret.hint).toBeNull();
      expect(secret.word).toBe("Apple");
    }
  });

  it("names every player in the order the phone is passed", () => {
    const round = deal(setupOf({ roster: ["  Karim ", "Ana", "Bo", "Zoe"] }));
    expect(round.players).toEqual(["Karim", "Ana", "Bo", "Zoe"]);
    expect(round.secrets.map((s) => s.name)).toEqual(round.players);
  });

  it("never exposes the drawn category anywhere in the round", () => {
    const round = deal(
      setupOf({ categories: ["animals"] }),
      [],
      poolOf({ animals: [entry("Otter")] }),
    );
    const dealt = JSON.stringify(round);
    for (const id of CATEGORY_IDS) {
      expect(dealt).not.toContain(id);
      expect(dealt).not.toContain(CATEGORY_LABELS[id]);
    }
  });
});

describe("startRound picks a starter", () => {
  const draws: Array<[string, number]> = [
    ["lowest random", 0],
    ["mid random", 0.5],
    ["highest random", 0.999999],
  ];

  it.each(draws)("%s keeps the starter inside the roster", (_label, value) => {
    const round = deal(
      setupOf({ roster: names(5) }),
      [],
      applePool,
      sequence(0, 0, value),
    );
    expect(round.starterIndex).toBeGreaterThanOrEqual(0);
    expect(round.starterIndex).toBeLessThan(5);
  });

  it("lets the imposter be the starter", () => {
    const round = deal(
      setupOf({ roster: names(5) }),
      [],
      applePool,
      sequence(0, 0.4, 0.4),
    );
    expect(round.starterIndex).toBe(round.imposterIndices[0]);
  });
});

describe("startRound respects the filters", () => {
  const pool = poolOf({
    foodAndDrink: [entry("Apple", 1), entry("Kohlrabi", 3)],
    animals: [entry("Otter", 1)],
  });

  it("draws only from the selected categories", () => {
    const round = deal(
      setupOf({ categories: ["animals"] }),
      [],
      pool,
      () => 0.999999,
    );
    expect(round.word).toBe("Otter");
  });

  it("draws only from the allowed levels: level 3 stays out by default", () => {
    const round = deal(
      setupOf({ categories: ["foodAndDrink"], levels: [1, 2] }),
      [],
      pool,
      () => 0.999999,
    );
    expect(round.word).toBe("Apple");
  });

  it("draws a level 3 word once level 3 is opted in", () => {
    const round = deal(
      setupOf({ categories: ["foodAndDrink"], levels: [3] }),
      [],
      pool,
      first,
    );
    expect(round.word).toBe("Kohlrabi");
  });

  it("combines several categories into one pool", () => {
    const setup = setupOf({
      categories: ["foodAndDrink", "animals"],
      levels: [1],
    });
    expect(deal(setup, [], pool, first).word).toBe("Apple");
    expect(deal(setup, [], pool, () => 0.999999).word).toBe("Otter");
  });

  it("rejects a setup whose filters select no words at all", () => {
    const result = startRound(setupOf({ levels: [2] }), [], pool, first);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.problem).toBe("emptyPool");
  });
});

describe("startRound and the recents buffer", () => {
  const twoWords = poolOf({ foodAndDrink: [entry("Apple"), entry("Bread")] });

  it("excludes a recently drawn word from the draw", () => {
    const round = deal(setupOf(), ["Apple"], twoWords, first);
    expect(round.word).toBe("Bread");
  });

  it("records the drawn word in the returned buffer", () => {
    const result = startRound(setupOf(), ["Apple"], twoWords, first);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.recents).toEqual(["Apple", "Bread"]);
  });

  it("clears the buffer and still draws when the filtered pool is exhausted", () => {
    const result = startRound(setupOf(), ["Apple", "Bread"], twoWords, first);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.round.word).toBe("Apple");
    expect(result.recents).toEqual(["Apple"]);
  });

  it(`keeps at most ${String(RECENTS_LIMIT)} words, dropping the oldest`, () => {
    const words = Array.from({ length: RECENTS_LIMIT + 2 }, (_, i) =>
      entry(`Word${String(i)}`),
    );
    const recents = words.slice(0, RECENTS_LIMIT).map((w) => w.word);
    const result = startRound(
      setupOf(),
      recents,
      poolOf({ foodAndDrink: words }),
      first,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.round.word).toBe(`Word${String(RECENTS_LIMIT)}`);
    expect(result.recents).toHaveLength(RECENTS_LIMIT);
    expect(result.recents).not.toContain("Word0");
    expect(result.recents.at(-1)).toBe(`Word${String(RECENTS_LIMIT)}`);
  });

  it("holds back words across categories, since the buffer is global", () => {
    const pool = poolOf({
      foodAndDrink: [entry("Apple")],
      animals: [entry("Otter")],
    });
    const round = deal(
      setupOf({ categories: ["foodAndDrink", "animals"] }),
      ["Apple"],
      pool,
      first,
    );
    expect(round.word).toBe("Otter");
  });
});

describe("validateSetup", () => {
  const long = "N".repeat(MAX_NAME_LENGTH + 1);
  const cases: Array<[string, Setup, SetupProblem]> = [
    ["two players", setupOf({ roster: names(2) }), "tooFewPlayers"],
    ["no players", setupOf({ roster: [] }), "tooFewPlayers"],
    ["thirteen players", setupOf({ roster: names(13) }), "tooManyPlayers"],
    [
      "duplicate names",
      setupOf({ roster: ["Ana", "Bo", "Ana"] }),
      "duplicateName",
    ],
    [
      "duplicate names differing only by case and space",
      setupOf({ roster: ["Ana", "Bo", " ana "] }),
      "duplicateName",
    ],
    [
      "a name over the limit",
      setupOf({ roster: ["Ana", "Bo", long] }),
      "nameTooLong",
    ],
    ["a blank name", setupOf({ roster: ["Ana", "Bo", "   "] }), "emptyName"],
    ["no categories selected", setupOf({ categories: [] }), "noCategories"],
    ["no levels allowed", setupOf({ levels: [] }), "noLevels"],
  ];

  it.each(cases)("rejects %s", (_label, setup, problem) => {
    const rejection = validateSetup(setup);
    expect(rejection?.problem).toBe(problem);
    expect(rejection?.message.length).toBeGreaterThan(0);
  });

  it("accepts a playable setup", () => {
    expect(validateSetup(setupOf())).toBeNull();
  });

  it("accepts the boundary player counts, 3 and 12", () => {
    expect(validateSetup(setupOf({ roster: names(3) }))).toBeNull();
    expect(validateSetup(setupOf({ roster: names(12) }))).toBeNull();
  });

  it("accepts a name of exactly the maximum length", () => {
    const exact = "N".repeat(MAX_NAME_LENGTH);
    expect(validateSetup(setupOf({ roster: ["Ana", "Bo", exact] }))).toBeNull();
  });
});

describe("startRound refuses to deal an invalid setup", () => {
  it("returns the rejection instead of a round", () => {
    const result = startRound(
      setupOf({ roster: names(2) }),
      [],
      applePool,
      first,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.problem).toBe("tooFewPlayers");
  });
});

describe("validateNewName", () => {
  it("accepts a fresh name", () => {
    expect(validateNewName(["Ana"], "Bo")).toBeNull();
  });

  it("rejects a blank name rather than adding an unnamed player", () => {
    expect(validateNewName([], "   ")?.problem).toBe("emptyName");
  });

  it("rejects an over-length name rather than shortening it", () => {
    const rejection = validateNewName([], "N".repeat(MAX_NAME_LENGTH + 1));
    expect(rejection?.problem).toBe("nameTooLong");
  });

  it("rejects a duplicate ignoring case and surrounding space", () => {
    expect(validateNewName(["Karim"], " karim ")?.problem).toBe(
      "duplicateName",
    );
  });

  it("rejects a thirteenth player", () => {
    expect(validateNewName(names(12), "Zoe")?.problem).toBe("tooManyPlayers");
  });
});

describe("persistence", () => {
  it("round-trips setup through storage", async () => {
    const storage = memoryStorage();
    const setup = setupOf({
      roster: ["Ana", "Bo", "Karim"],
      categories: ["animals", "jobs"],
      levels: [1, 2, 3],
    });
    await saveSetup(storage, setup);
    const loaded = await loadSession(storage);
    expect(loaded.setup).toEqual(setup);
  });

  it("round-trips the recents buffer through storage", async () => {
    const storage = memoryStorage();
    await saveRecents(storage, ["Apple", "Bread"]);
    const loaded = await loadSession(storage);
    expect(loaded.recents).toEqual(["Apple", "Bread"]);
  });

  it("returns defaults when nothing has been stored", async () => {
    const loaded = await loadSession(memoryStorage());
    expect(loaded.setup).toEqual(DEFAULT_SETUP);
    expect(loaded.recents).toEqual([]);
  });

  it("writes only the two versioned keys", async () => {
    const storage = memoryStorage();
    await saveSetup(storage, setupOf());
    await saveRecents(storage, ["Apple"]);
    expect(storage.keys().sort()).toEqual([RECENTS_KEY, SETUP_KEY].sort());
  });

  it("never persists round state", async () => {
    const storage = memoryStorage();
    startRound(setupOf(), [], applePool, first);
    expect(storage.keys()).toEqual([]);
  });

  it("trims stored names and normalizes the selection order on load", async () => {
    const storage = memoryStorage({
      [SETUP_KEY]: JSON.stringify({
        version: 1,
        roster: [" Ana ", "Bo", "Karim"],
        categories: ["jobs", "animals", "animals"],
        levels: [2, 1],
      }),
    });
    const loaded = await loadSession(storage);
    expect(loaded.setup.roster).toEqual(["Ana", "Bo", "Karim"]);
    expect(loaded.setup.categories).toEqual(["animals", "jobs"]);
    expect(loaded.setup.levels).toEqual([1, 2]);
  });
});

describe("stored setup falls back to defaults", () => {
  const cases: Array<[string, string]> = [
    ["not json", "{oops"],
    ["not an object", '"hi"'],
    ["null literal", "null"],
    ["truncated json", '{"version":1,"roster":["Ana"'],
    [
      "stale schema version",
      '{"version":0,"roster":["Ana"],"categories":["jobs"],"levels":[1]}',
    ],
    [
      "no version stamp",
      '{"roster":["Ana"],"categories":["jobs"],"levels":[1]}',
    ],
    ["missing fields", '{"version":1}'],
    [
      "renamed field from an older schema",
      '{"version":1,"players":["Ana"],"categories":["jobs"],"levels":[1]}',
    ],
    [
      "unknown category id",
      '{"version":1,"roster":["Ana"],"categories":["movies"],"levels":[1]}',
    ],
    [
      "out-of-range level",
      '{"version":1,"roster":["Ana"],"categories":["jobs"],"levels":[4]}',
    ],
    [
      "non-string roster entry",
      '{"version":1,"roster":[7],"categories":["jobs"],"levels":[1]}',
    ],
    [
      "blank roster entry",
      '{"version":1,"roster":["  "],"categories":["jobs"],"levels":[1]}',
    ],
    [
      "roster is not an array",
      '{"version":1,"roster":"Ana","categories":["jobs"],"levels":[1]}',
    ],
  ];

  it.each(cases)("%s → DEFAULT_SETUP", async (_label, raw) => {
    const loaded = await loadSession(memoryStorage({ [SETUP_KEY]: raw }));
    expect(loaded.setup).toEqual(DEFAULT_SETUP);
  });
});

describe("stored recents fall back to an empty buffer", () => {
  const cases: Array<[string, string]> = [
    ["not json", "[oops"],
    ["not an object", "42"],
    ["truncated json", '{"version":1,"words":["Apple"'],
    ["stale schema version", '{"version":0,"words":["Apple"]}'],
    ["no version stamp", '{"words":["Apple"]}'],
    ["missing words", '{"version":1}'],
    ["words is not an array", '{"version":1,"words":"Apple"}'],
    ["non-string word", '{"version":1,"words":[7]}'],
  ];

  it.each(cases)("%s → empty", async (_label, raw) => {
    const loaded = await loadSession(memoryStorage({ [RECENTS_KEY]: raw }));
    expect(loaded.recents).toEqual([]);
  });

  it("still draws after a corrupt buffer is discarded", async () => {
    const storage = memoryStorage({ [RECENTS_KEY]: "{oops" });
    const { recents } = await loadSession(storage);
    expect(deal(setupOf(), recents).word).toBe("Apple");
  });

  it("caps an oversized stored buffer at the limit", async () => {
    const words = Array.from(
      { length: RECENTS_LIMIT + 5 },
      (_, i) => `Word${String(i)}`,
    );
    const storage = memoryStorage({
      [RECENTS_KEY]: JSON.stringify({ version: 1, words }),
    });
    const loaded = await loadSession(storage);
    expect(loaded.recents).toHaveLength(RECENTS_LIMIT);
    expect(loaded.recents.at(-1)).toBe(`Word${String(RECENTS_LIMIT + 4)}`);
  });

  it("keeps one key's corruption from poisoning the other", async () => {
    const storage = memoryStorage({
      [SETUP_KEY]: "{oops",
      [RECENTS_KEY]: JSON.stringify({ version: 1, words: ["Apple"] }),
    });
    const loaded = await loadSession(storage);
    expect(loaded.setup).toEqual(DEFAULT_SETUP);
    expect(loaded.recents).toEqual(["Apple"]);
  });
});
