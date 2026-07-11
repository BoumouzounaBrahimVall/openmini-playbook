import { mini } from "@openmini/runtime";
import { useEffect } from "react";
import { AppHeader } from "./components/AppHeader.js";
import { Board } from "./components/Board.js";
import { useSnake } from "./game/useSnake.js";

export function App() {
  const { state, steer, restart } = useSnake();

  useEffect(() => {
    void mini.system
      .getInfo()
      .then((info) => {
        document.documentElement.dataset.theme = info.theme;
      })
      .catch((error: unknown) => {
        console.error("snake: getInfo failed", error);
      });
  }, []);

  return (
    <div className="screen">
      <AppHeader title="Snake" />
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
            Restart
          </button>
        </section>
        <Board state={state} onSteer={steer} onRestart={restart} />
      </main>
    </div>
  );
}
