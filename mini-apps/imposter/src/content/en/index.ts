import type { Catalog } from "../types.js";
import { animals } from "./animals.js";
import { foodAndDrink } from "./foodAndDrink.js";
import { jobs } from "./jobs.js";
import { objects } from "./objects.js";
import { places } from "./places.js";

/** The bundled English catalog: the default word pool for a round. */
export const CATALOG: Catalog = {
  foodAndDrink,
  animals,
  places,
  jobs,
  objects,
};
