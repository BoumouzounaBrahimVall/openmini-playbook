import { mini } from "@openmini/runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "./components/AppHeader.js";
import { PassLoop } from "./components/PassLoop.js";
import { RevealScreen } from "./components/RevealScreen.js";
import { RoundReadyScreen } from "./components/RoundReadyScreen.js";
import { SetupScreen } from "./components/SetupScreen.js";
import { useSession } from "./session/useSession.js";
import type { Round, SetupRejection } from "./session/session.js";

/** The four screens, in the order a round walks through them. */
type Screen = "setup" | "pass" | "ready" | "reveal";

export function App() {
  const {
    setup,
    hydrated,
    addPlayer,
    removePlayer,
    movePlayer,
    toggleCategory,
    toggleLevel,
    deal,
  } = useSession();

  // Round state lives here and only here: it is never written to storage, so a
  // relaunch always starts at setup rather than resurrecting a half-dealt round
  // whose secrecy cannot be reasoned about after the fact.
  const [screen, setScreen] = useState<Screen>("setup");
  const [round, setRound] = useState<Round | null>(null);
  const [passIndex, setPassIndex] = useState(0);
  const [drawRejection, setDrawRejection] = useState<SetupRejection | null>(
    null,
  );

  // Follow the host theme (light/dark) reported by the bridge. The reveal
  // screens override it in CSS regardless of what comes back.
  useEffect(() => {
    void mini.system
      .getInfo()
      .then((info) => {
        document.documentElement.dataset.theme = info.theme;
      })
      .catch((error: unknown) => {
        console.error("imposter: getInfo failed", error);
      });
  }, []);

  const startRound = useCallback(() => {
    const result = deal();
    if (!result.ok) {
      // A rejected draw is a real state, not a crash: the organizer is told
      // why on the setup screen and can widen the filters.
      setDrawRejection(result.rejection);
      setRound(null);
      setScreen("setup");
      return;
    }
    setDrawRejection(null);
    setRound(result.round);
    setPassIndex(0);
    setScreen("pass");
  }, [deal]);

  const editPlayers = useCallback(() => {
    setRound(null);
    setDrawRejection(null);
    setScreen("setup");
  }, []);

  const passOn = useCallback(() => {
    if (round === null) return;
    if (passIndex + 1 < round.players.length) {
      setPassIndex(passIndex + 1);
      return;
    }
    setScreen("ready");
  }, [round, passIndex]);

  // Backgrounded mid-pass, the round is abandoned rather than left half-dealt:
  // afterwards nobody can tell who had already looked.
  const screenRef = useRef(screen);
  screenRef.current = screen;
  useEffect(() => {
    const abandonPass = () => {
      if (screenRef.current === "pass") editPlayers();
    };
    const offHide = mini.lifecycle.onHide(abandonPass);
    return () => {
      offHide();
    };
  }, [editPlayers]);

  function renderScreen() {
    if (round === null || screen === "setup") {
      // The saved roster is still on its way; showing an empty one first would
      // read as "the app forgot us".
      if (!hydrated) return <main className="setup" />;
      return (
        <SetupScreen
          setup={setup}
          drawRejection={drawRejection}
          onAddPlayer={addPlayer}
          onRemovePlayer={removePlayer}
          onMovePlayer={movePlayer}
          onToggleCategory={toggleCategory}
          onToggleLevel={toggleLevel}
          onStart={startRound}
        />
      );
    }
    if (screen === "pass") {
      return <PassLoop round={round} index={passIndex} onPassedOn={passOn} />;
    }
    if (screen === "ready") {
      return (
        <RoundReadyScreen
          starter={round.players[round.starterIndex]}
          onOpenReveal={() => setScreen("reveal")}
        />
      );
    }
    return (
      <RevealScreen
        round={round}
        onNewRound={startRound}
        onEditPlayers={editPlayers}
      />
    );
  }

  return (
    <div className="screen" data-screen={screen}>
      <AppHeader title="Imposter" />
      {renderScreen()}
    </div>
  );
}
