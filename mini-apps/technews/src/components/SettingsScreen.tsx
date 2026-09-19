import { useState } from "react";
import { normalizeKeyword } from "../prefs/store.js";

interface SettingsScreenProps {
  keywords: readonly string[];
  onAdd: (raw: string) => void;
  onRemove: (keyword: string) => void;
}

/**
 * The keyword list behind the gear. Every change is persisted by the hook
 * that owns the list; this screen only edits it. Matching is whole-word and
 * case-insensitive, which is why the hint below the input says so.
 */
export function SettingsScreen({ keywords, onAdd, onRemove }: SettingsScreenProps) {
  const [draft, setDraft] = useState("");
  const normalized = normalizeKeyword(draft);
  const duplicate = keywords.includes(normalized);

  function submit() {
    if (normalized.length === 0 || duplicate) return;
    onAdd(draft);
    setDraft("");
  }

  return (
    <main className="settings">
      <section className="panel">
        <p className="micro">Keywords</p>
        <form
          className="keyword-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            className="keyword-input"
            type="text"
            value={draft}
            placeholder="Add a topic"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-label="Keyword"
            aria-invalid={duplicate}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="submit"
            className="btn-ghost"
            disabled={normalized.length === 0 || duplicate}
          >
            Add
          </button>
        </form>
        {duplicate ? (
          <p className="hint" role="alert">
            Already on the list.
          </p>
        ) : (
          <p className="hint">
            Whole words in the title or the source domain, any case.
          </p>
        )}
        {keywords.length > 0 ? (
          <ul className="keyword-list">
            {keywords.map((keyword) => (
              <li key={keyword} className="keyword-chip">
                <span>{keyword}</span>
                <button
                  type="button"
                  className="keyword-remove"
                  aria-label={`Remove ${keyword}`}
                  onClick={() => onRemove(keyword)}
                >
                  &#10005;
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">No keywords. The feed is ranked by the crowd alone.</p>
        )}
      </section>
    </main>
  );
}
