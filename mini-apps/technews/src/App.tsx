import { mini } from "@openmini/runtime";
import { useEffect, useState } from "react";
import { AppHeader } from "./components/AppHeader.js";
import { FeedScreen } from "./components/FeedScreen.js";
import { SettingsScreen } from "./components/SettingsScreen.js";
import { useFeed } from "./feed/useFeed.js";
import { usePrefs } from "./prefs/usePrefs.js";

type Screen = "feed" | "settings";

export function App() {
  const [screen, setScreen] = useState<Screen>("feed");
  // Taken once at launch: the day windows and the catch-up both hang off it.
  const [anchor] = useState(() => Math.floor(Date.now() / 1000));
  const prefs = usePrefs(anchor);
  const feed = useFeed(
    anchor,
    prefs.keywords,
    prefs.hydrated ? prefs.keywords.join("\u0000") : null,
  );

  // Follow the host theme (light/dark) and its safe-area insets. The insets
  // come from the bridge rather than CSS env(), which not every host WebView
  // populates.
  useEffect(() => {
    void mini.system
      .getInfo()
      .then((info) => {
        const root = document.documentElement;
        root.dataset.theme = info.theme;
        root.style.setProperty("--safe-top", `${String(info.safeArea.top)}px`);
        root.style.setProperty(
          "--safe-bottom",
          `${String(info.safeArea.bottom)}px`,
        );
      })
      .catch((error: unknown) => {
        console.error("technews: getInfo failed", error);
      });
  }, []);

  return (
    <div className="screen" data-screen={screen}>
      <AppHeader
        title="Tech News"
        action={screen === "feed" ? "settings" : "back"}
        onAction={() => setScreen(screen === "feed" ? "settings" : "feed")}
      />
      {screen === "settings" ? (
        <SettingsScreen
          keywords={prefs.keywords}
          onAdd={prefs.add}
          onRemove={prefs.remove}
        />
      ) : (
        <FeedScreen
          windows={feed.windows}
          selected={feed.selected}
          onSelect={feed.select}
          state={feed.state}
          feed={feed.feed}
          keywords={prefs.keywords}
          catchUp={prefs.catchUp}
          onRetry={feed.retry}
          onRefresh={feed.refresh}
        />
      )}
    </div>
  );
}
