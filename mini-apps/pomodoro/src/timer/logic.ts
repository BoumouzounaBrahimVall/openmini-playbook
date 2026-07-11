export type Phase = "focus" | "shortBreak" | "longBreak";

export interface TimerState {
  phase: Phase;
  /** Time left in the current phase. */
  remainingMs: number;
  running: boolean;
  /** Focus sessions completed since launch (drives the long-break cadence). */
  completedFocus: number;
}

export const PHASE_DURATION_MS: Record<Phase, number> = {
  focus: 25 * 60_000,
  shortBreak: 5 * 60_000,
  longBreak: 15 * 60_000,
};

/** Every Nth focus session is followed by a long break. */
export const LONG_BREAK_EVERY = 4;

export const PHASE_LABEL: Record<Phase, string> = {
  focus: "Focus",
  shortBreak: "Short break",
  longBreak: "Long break",
};

export function initialState(completedFocus = 0): TimerState {
  return {
    phase: "focus",
    remainingMs: PHASE_DURATION_MS.focus,
    running: false,
    completedFocus,
  };
}

export function start(state: TimerState): TimerState {
  return state.running ? state : { ...state, running: true };
}

export function pause(state: TimerState): TimerState {
  return state.running ? { ...state, running: false } : state;
}

/** Restart the current phase from its full duration, paused. */
export function reset(state: TimerState): TimerState {
  return {
    ...state,
    remainingMs: PHASE_DURATION_MS[state.phase],
    running: false,
  };
}

function nextPhase(state: TimerState): { phase: Phase; completedFocus: number } {
  if (state.phase === "focus") {
    const completedFocus = state.completedFocus + 1;
    const phase =
      completedFocus % LONG_BREAK_EVERY === 0 ? "longBreak" : "shortBreak";
    return { phase, completedFocus };
  }
  return { phase: "focus", completedFocus: state.completedFocus };
}

/** Jump to the next phase, paused. Counts a skipped focus as completed. */
export function skip(state: TimerState): TimerState {
  const next = nextPhase(state);
  return {
    phase: next.phase,
    remainingMs: PHASE_DURATION_MS[next.phase],
    running: false,
    completedFocus: next.completedFocus,
  };
}

export interface TickResult {
  state: TimerState;
  /** Set when the tick crossed the end of a phase. */
  ended: Phase | null;
}

/**
 * Advance the clock by elapsedMs. On phase end the timer rolls into the next
 * phase and keeps running; leftover time carries over so long timer gaps
 * (background tabs) stay accurate.
 */
export function tick(state: TimerState, elapsedMs: number): TickResult {
  if (!state.running || elapsedMs <= 0) return { state, ended: null };
  if (elapsedMs < state.remainingMs) {
    return {
      state: { ...state, remainingMs: state.remainingMs - elapsedMs },
      ended: null,
    };
  }
  const carryOver = elapsedMs - state.remainingMs;
  const next = nextPhase(state);
  const rolled: TimerState = {
    phase: next.phase,
    remainingMs: PHASE_DURATION_MS[next.phase],
    running: true,
    completedFocus: next.completedFocus,
  };
  // Consume the carry-over inside the new phase (recursion depth is bounded
  // by elapsed/phase-duration, effectively tiny for real clock deltas).
  const settled =
    carryOver > 0 ? tick(rolled, Math.min(carryOver, rolled.remainingMs - 1)).state : rolled;
  return { state: settled, ended: state.phase };
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** 0 → phase just started, 1 → phase finished. */
export function progress(state: TimerState): number {
  const total = PHASE_DURATION_MS[state.phase];
  return Math.min(1, Math.max(0, 1 - state.remainingMs / total));
}
