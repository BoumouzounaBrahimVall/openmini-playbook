interface FocusChipsProps {
  keywords: readonly string[];
  /** Keywords currently in focus; empty means everything is shown. */
  focus: readonly string[];
  onToggle: (keyword: string) => void;
  onClear: () => void;
}

/**
 * A session-only filter over the day's stories: "All", or any set of the
 * keywords you follow. Purely local, so it never costs a request; it narrows
 * what is on screen to the topics you want first.
 */
export function FocusChips({ keywords, focus, onToggle, onClear }: FocusChipsProps) {
  if (keywords.length === 0) return null;
  return (
    <div className="focus-chips" role="group" aria-label="Show only">
      <button
        type="button"
        className="focus-chip"
        aria-pressed={focus.length === 0}
        onClick={onClear}
      >
        All
      </button>
      {keywords.map((keyword) => (
        <button
          key={keyword}
          type="button"
          className="focus-chip"
          aria-pressed={focus.includes(keyword)}
          onClick={() => onToggle(keyword)}
        >
          {keyword}
        </button>
      ))}
    </div>
  );
}
