import { mini } from "@openmini/runtime";
import { useEffect } from "react";
import { AppHeader } from "./components/AppHeader.js";
import {
  LONG_BREAK_EVERY,
  PHASE_LABEL,
  formatTime,
  progress,
} from "./timer/logic.js";
import { useTimer } from "./timer/useTimer.js";

const RING_RADIUS = 88;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function App() {
  const { state, onStart, onPause, onReset, onSkip } = useTimer();

  // Follow the host theme (light/dark) reported by the bridge.
  useEffect(() => {
    void mini.system
      .getInfo()
      .then((info) => {
        document.documentElement.dataset.theme = info.theme;
      })
      .catch((error: unknown) => {
        console.error("pomodoro: getInfo failed", error);
      });
  }, []);

  const dashOffset = RING_CIRCUMFERENCE * (1 - progress(state));
  const cycleDot = state.completedFocus % LONG_BREAK_EVERY;

  return (
    <div className="screen" data-phase={state.phase}>
      <AppHeader title="Pomodoro" />
      <main className="timer">
        <span className="phase-label">{PHASE_LABEL[state.phase]}</span>

        <div className="ring-wrap">
          <svg
            className="ring"
            viewBox="0 0 200 200"
            role="img"
            aria-label={`${PHASE_LABEL[state.phase]}: ${formatTime(state.remainingMs)} left`}
          >
            <circle className="ring-track" cx="100" cy="100" r={RING_RADIUS} />
            <circle
              className="ring-progress"
              cx="100"
              cy="100"
              r={RING_RADIUS}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <span className="time">{formatTime(state.remainingMs)}</span>
        </div>

        <div
          className="cycle-dots"
          aria-label={`${cycleDot} of ${LONG_BREAK_EVERY} sessions until a long break`}
        >
          {Array.from({ length: LONG_BREAK_EVERY }, (_, i) => (
            <span
              key={i}
              className={i < cycleDot ? "dot dot-done" : "dot"}
            />
          ))}
        </div>

        <div className="controls">
          <button type="button" className="btn" onClick={onReset}>
            Reset
          </button>
          {state.running ? (
            <button type="button" className="btn btn-primary" onClick={onPause}>
              Pause
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onStart}>
              Start
            </button>
          )}
          <button type="button" className="btn" onClick={onSkip}>
            Skip
          </button>
        </div>

        <p className="stats">
          {state.completedFocus} focus session
          {state.completedFocus === 1 ? "" : "s"} completed
        </p>
      </main>
    </div>
  );
}
