import { DAY_SECONDS, WINDOW_COUNT } from "../feed/feed.js";

export interface CatchUp {
  /** Whole days since the app was last opened. */
  awayDays: number;
  /** Chips whose entire 24h window falls after the last visit, Today excluded. */
  unseenDaysAgo: readonly number[];
}

/**
 * What to tell someone who has been away. Today is never "unseen" since that
 * is where the app lands. A chip counts as unseen only when all of its window
 * is newer than the last visit: three days away leaves Yesterday and 2d unseen,
 * while 3d was partly on screen last time.
 */
export function catchUp(lastOpened: number | null, now: number): CatchUp | null {
  if (lastOpened === null) return null;
  const awayDays = Math.floor((now - lastOpened) / DAY_SECONDS);
  if (awayDays < 1) return null;
  const lastUnseen = Math.min(awayDays - 1, WINDOW_COUNT - 1);
  const unseenDaysAgo = Array.from(
    { length: Math.max(lastUnseen, 0) },
    (_, index) => index + 1,
  );
  return { awayDays, unseenDaysAgo };
}
