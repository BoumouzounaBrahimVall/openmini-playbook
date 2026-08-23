import { describe, expect, it } from "vitest";
import { CATEGORY_IDS, CATEGORY_LABELS } from "./types.js";

describe("category metadata", () => {
  it("declares exactly five categories", () => {
    expect(CATEGORY_IDS).toHaveLength(5);
  });

  it.each(CATEGORY_IDS)("%s has a non-empty display label", (id) => {
    expect(CATEGORY_LABELS[id].length).toBeGreaterThan(0);
  });
});
