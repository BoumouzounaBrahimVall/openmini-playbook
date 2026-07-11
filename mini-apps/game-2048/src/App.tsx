import { mini } from "@openmini/runtime";
import { useEffect } from "react";
import { AppHeader } from "./components/AppHeader.js";
import { Board } from "./components/Board.js";
import { useGame } from "./game/useGame.js";

export function App() {
  const { state, dispatch, restart, continueGame } = useGame();

  // Follow the host theme (light/dark) reported by the bridge.
  useEffect(() => {
    void mini.system
      .getInfo()
      .then((info) => {
        document.documentElement.dataset.theme = info.theme;
      })
      .catch((error: unknown) => {
        console.error("2048: getInfo failed", error);
      });
  }, []);

  return (
    <div className="screen">
      <AppHeader title="2048" />
      <main className="game">
        <section className="scoreboard">
          <div className="score-chip">
            <span className="score-label">Score</span>
            <span className="score-value">{state.score}</span>
          </div>
          <div className="score-chip">
            <span className="score-label">Best</span>
            <span className="score-value">{state.best}</span>
          </div>
          <button type="button" className="btn btn-primary" onClick={restart}>
            New game
          </button>
        </section>
        <Board
          state={state}
          onSwipe={dispatch}
          onRestart={restart}
          onContinue={continueGame}
        />
        <p className="hint">Swipe to move the tiles. Same numbers merge!</p>
      </main>
    </div>
  );
}
