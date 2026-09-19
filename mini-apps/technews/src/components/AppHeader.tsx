import { mini } from "@openmini/runtime";

interface AppHeaderProps {
  title: string;
  /** Which secondary control sits beside the close button. */
  action: "settings" | "back";
  onAction: () => void;
}

/**
 * The host draws no chrome, so this header is the only way out: the close
 * button asks the host to dismiss the app. The other button flips between
 * the gear that opens the keyword screen and the arrow that leaves it.
 */
export function AppHeader({ title, action, onAction }: AppHeaderProps) {
  async function close() {
    try {
      await mini.navigation.close();
    } catch (error: unknown) {
      console.error("technews: close failed", error);
    }
  }

  return (
    <header className="app-header">
      <h1 className="app-header-title">{title}</h1>
      <div className="capsule" role="group" aria-label="Mini app controls">
        <button
          type="button"
          className="capsule-btn"
          aria-label={action === "settings" ? "Keywords" : "Back to the feed"}
          onClick={onAction}
        >
          {action === "settings" ? <GearIcon /> : <span aria-hidden="true">&#8592;</span>}
        </button>
        <span className="capsule-divider" aria-hidden="true" />
        <button
          type="button"
          className="capsule-btn"
          aria-label="Close mini app"
          onClick={() => void close()}
        >
          &#10005;
        </button>
      </div>
    </header>
  );
}

function GearIcon() {
  return (
    <svg
      className="capsule-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
