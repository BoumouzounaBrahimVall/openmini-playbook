/**
 * The shared shape of the word catalog. Content files under `en/` only ever
 * export data typed against these declarations, so the session module and the
 * catalog lint suite agree on one surface.
 */

/** Difficulty tier of a word: 1 easy, 2 medium, 3 hard (opt-in). */
export type Level = 1 | 2 | 3;

/** One playable word plus the hint the imposter receives instead of it. */
export interface WordEntry {
  word: string;
  hint: string;
  level: Level;
}

/** Stable identifier of a word category. */
export type CategoryId =
  | "foodAndDrink"
  | "animals"
  | "places"
  | "jobs"
  | "objects";

/** The full bundled catalog: every category mapped to its entries. */
export type Catalog = Record<CategoryId, readonly WordEntry[]>;

/** Every category id, in the order they are offered on the setup screen. */
export const CATEGORY_IDS: readonly CategoryId[] = [
  "foodAndDrink",
  "animals",
  "places",
  "jobs",
  "objects",
];

/** Display name for each category id. */
export const CATEGORY_LABELS: Record<CategoryId, string> = {
  foodAndDrink: "Food & Drink",
  animals: "Animals",
  places: "Places",
  jobs: "Jobs",
  objects: "Objects",
};
