import { useState } from "react";
import {
  MAX_PLAYERS,
  validateNewName,
  validateSetup,
  type Setup,
  type SetupRejection,
} from "../session/session.js";
import {
  CATEGORY_IDS,
  CATEGORY_LABELS,
  type CategoryId,
  type Level,
} from "../content/types.js";

/** The difficulty control, in tier order. Tier 3 is opt-in. */
const LEVELS: ReadonlyArray<[Level, string]> = [
  [1, "Easy"],
  [2, "Medium"],
  [3, "Hard"],
];

interface SetupScreenProps {
  setup: Setup;
  /** Left over from the last draw attempt — e.g. the pool came back empty. */
  drawRejection: SetupRejection | null;
  onAddPlayer: (name: string) => SetupRejection | null;
  onRemovePlayer: (index: number) => void;
  onToggleCategory: (id: CategoryId) => void;
  onToggleLevel: (level: Level) => void;
  onStart: () => void;
}

/**
 * The roster, the categories and the difficulty. The organizer lands here on
 * every launch even when a roster was restored, so whoever went home can be
 * dropped before they are dealt a word.
 *
 * Every rule shown here comes from the session module: the name input asks
 * `validateNewName`, and the Start button's disabled reason is whatever
 * `validateSetup` says. This screen holds no rules of its own.
 */
export function SetupScreen({
  setup,
  drawRejection,
  onAddPlayer,
  onRemovePlayer,
  onToggleCategory,
  onToggleLevel,
  onStart,
}: SetupScreenProps) {
  const [draft, setDraft] = useState("");

  // Checked on every keystroke so an over-long or duplicate name is refused at
  // the input, with a reason, instead of being silently shortened on submit.
  const draftRejection =
    draft.length === 0 ? null : validateNewName(setup.roster, draft);
  const blocker = validateSetup(setup);

  function submitName() {
    if (onAddPlayer(draft) === null) setDraft("");
  }

  return (
    <main className="setup">
      <section className="panel">
        <h2 className="panel-title">
          Players
          <span className="panel-count">
            {setup.roster.length} of {MAX_PLAYERS}
          </span>
        </h2>
        <form
          className="name-row"
          onSubmit={(event) => {
            event.preventDefault();
            submitName();
          }}
        >
          <input
            className="name-input"
            type="text"
            value={draft}
            placeholder="Add a player"
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            aria-label="Player name"
            aria-invalid={draftRejection !== null}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={draft.trim().length === 0 || draftRejection !== null}
          >
            Add
          </button>
        </form>
        {draftRejection ? (
          <p className="error" role="alert">
            {draftRejection.message}
          </p>
        ) : null}
        {setup.roster.length > 0 ? (
          <ul className="roster">
            {setup.roster.map((name, index) => (
              <li className="roster-item" key={`${name}-${String(index)}`}>
                <span className="roster-name">{name}</span>
                <button
                  type="button"
                  className="roster-remove"
                  aria-label={`Remove ${name}`}
                  onClick={() => onRemovePlayer(index)}
                >
                  &#10005;
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">Everyone at the table, one name each.</p>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">Categories</h2>
        <div className="chips">
          {CATEGORY_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={setup.categories.includes(id)}
              onClick={() => onToggleCategory(id)}
            >
              {CATEGORY_LABELS[id]}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Difficulty</h2>
        <div className="chips">
          {LEVELS.map(([level, label]) => (
            <button
              key={level}
              type="button"
              className="chip"
              aria-pressed={setup.levels.includes(level)}
              onClick={() => onToggleLevel(level)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="hint">Hard adds words some of the table may not know.</p>
      </section>

      <section className="start">
        {drawRejection ? (
          <p className="error" role="alert">
            {drawRejection.message}
          </p>
        ) : null}
        <button
          type="button"
          className="btn btn-primary btn-wide"
          disabled={blocker !== null}
          onClick={onStart}
        >
          Start round
        </button>
        {blocker ? <p className="hint">{blocker.message}</p> : null}
      </section>
    </main>
  );
}
