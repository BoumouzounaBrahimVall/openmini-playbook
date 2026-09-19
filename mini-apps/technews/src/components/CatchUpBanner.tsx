import type { CatchUp } from "../prefs/catchup.js";

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? "" : "s"}`;
}

/** One line for someone who has been away; the unseen chips carry a dot. */
export function CatchUpBanner({ awayDays, unseenDaysAgo }: CatchUp) {
  const unseen =
    unseenDaysAgo.length > 0
      ? ` · ${plural(unseenDaysAgo.length, "day")} unseen`
      : "";
  return (
    <p className="catch-up" role="status">
      Away {plural(awayDays, "day")}
      {unseen}
    </p>
  );
}
