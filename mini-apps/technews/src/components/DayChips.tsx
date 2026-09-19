import { windowLabel, type DayWindow } from "../feed/feed.js";

interface DayChipsProps {
  windows: readonly DayWindow[];
  selected: number;
  /** Days-ago values that were never on screen since the last visit. */
  unseen: readonly number[];
  onSelect: (daysAgo: number) => void;
}

/** Seven rolling 24h windows as a horizontal row, Today first. */
export function DayChips({ windows, selected, unseen, onSelect }: DayChipsProps) {
  return (
    <div className="day-chips" role="tablist" aria-label="Day">
      {windows.map((window) => {
        const isUnseen = unseen.includes(window.daysAgo);
        const label = windowLabel(window.daysAgo);
        return (
          <button
            key={window.daysAgo}
            type="button"
            role="tab"
            className="day-chip"
            aria-selected={window.daysAgo === selected}
            aria-label={isUnseen ? `${label}, unseen` : label}
            data-unseen={isUnseen ? "yes" : "no"}
            onClick={() => onSelect(window.daysAgo)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
