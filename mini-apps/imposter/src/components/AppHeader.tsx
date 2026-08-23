import { mini } from "@openmini/runtime";

interface AppHeaderProps {
  title: string;
}

/**
 * Mini-app chrome: centered title plus the host-style capsule with a
 * "more" action and an ✕ that asks the host to dismiss the app.
 */
export function AppHeader({ title }: AppHeaderProps) {
  async function showAbout() {
    try {
      await mini.ui.showToast({
        message:
          "Imposter — everyone gets the same secret word except one player, who only gets a hint. Talk it out and find them.",
        durationMs: 4000,
      });
    } catch (error: unknown) {
      console.error("imposter: toast failed", error);
    }
  }

  async function close() {
    try {
      await mini.navigation.close();
    } catch (error: unknown) {
      console.error("imposter: close failed", error);
    }
  }

  return (
    <header className="app-header">
      <span className="app-header-title">{title}</span>
      <div className="capsule" role="group" aria-label="Mini app controls">
        <button
          type="button"
          className="capsule-btn"
          aria-label="About"
          onClick={() => void showAbout()}
        >
          &#8943;
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
