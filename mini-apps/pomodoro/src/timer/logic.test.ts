import { describe, expect, it } from "vitest";
import {
  LONG_BREAK_EVERY,
  PHASE_DURATION_MS,
  formatTime,
  initialState,
  pause,
  progress,
  reset,
  skip,
  start,
  tick,
} from "./logic.js";

describe("initialState", () => {
  it("starts paused on a full focus phase", () => {
    const state = initialState();
    expect(state).toEqual({
      phase: "focus",
      remainingMs: PHASE_DURATION_MS.focus,
      running: false,
      completedFocus: 0,
    });
  });
});

describe("start / pause / reset", () => {
  it("start and pause toggle running without touching the clock", () => {
    const started = start(initialState());
    expect(started.running).toBe(true);
    expect(pause(started).running).toBe(false);
    expect(started.remainingMs).toBe(PHASE_DURATION_MS.focus);
  });

  it("reset refills the current phase and pauses", () => {
    const mid = tick(start(initialState()), 60_000).state;
    const resetState = reset(mid);
    expect(resetState.remainingMs).toBe(PHASE_DURATION_MS.focus);
    expect(resetState.running).toBe(false);
    expect(resetState.phase).toBe("focus");
  });
});

describe("tick", () => {
  it("does nothing while paused", () => {
    const state = initialState();
    expect(tick(state, 5000).state).toBe(state);
  });

  it("counts down within a phase", () => {
    const { state, ended } = tick(start(initialState()), 1000);
    expect(state.remainingMs).toBe(PHASE_DURATION_MS.focus - 1000);
    expect(ended).toBeNull();
  });

  it("rolls a finished focus into a short break and keeps running", () => {
    const { state, ended } = tick(
      start(initialState()),
      PHASE_DURATION_MS.focus,
    );
    expect(ended).toBe("focus");
    expect(state.phase).toBe("shortBreak");
    expect(state.running).toBe(true);
    expect(state.completedFocus).toBe(1);
  });

  it("carries excess elapsed time into the next phase", () => {
    const { state } = tick(
      start(initialState()),
      PHASE_DURATION_MS.focus + 30_000,
    );
    expect(state.phase).toBe("shortBreak");
    expect(state.remainingMs).toBe(PHASE_DURATION_MS.shortBreak - 30_000);
  });

  it("gives a long break after the 4th focus session", () => {
    let state = start(initialState(LONG_BREAK_EVERY - 1));
    const result = tick(state, PHASE_DURATION_MS.focus);
    expect(result.state.phase).toBe("longBreak");
    expect(result.state.completedFocus).toBe(LONG_BREAK_EVERY);
  });

  it("returns to focus after a break", () => {
    const inBreak = tick(start(initialState()), PHASE_DURATION_MS.focus).state;
    const { state, ended } = tick(inBreak, PHASE_DURATION_MS.shortBreak);
    expect(ended).toBe("shortBreak");
    expect(state.phase).toBe("focus");
    expect(state.completedFocus).toBe(1);
  });

  it("does not mutate the input state", () => {
    const before = start(initialState());
    const snapshot = JSON.stringify(before);
    tick(before, PHASE_DURATION_MS.focus + 5);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe("skip", () => {
  it("skipping focus counts it and moves to a break, paused", () => {
    const state = skip(start(initialState()));
    expect(state.phase).toBe("shortBreak");
    expect(state.completedFocus).toBe(1);
    expect(state.running).toBe(false);
  });

  it("skipping a break returns to focus without counting", () => {
    const state = skip(skip(initialState()));
    expect(state.phase).toBe("focus");
    expect(state.completedFocus).toBe(1);
  });
});

describe("formatTime / progress", () => {
  it("formats minutes and seconds", () => {
    expect(formatTime(25 * 60_000)).toBe("25:00");
    expect(formatTime(61_000)).toBe("01:01");
    expect(formatTime(500)).toBe("00:01");
    expect(formatTime(0)).toBe("00:00");
  });

  it("progress runs 0 → 1 across a phase", () => {
    expect(progress(initialState())).toBe(0);
    const half = tick(start(initialState()), PHASE_DURATION_MS.focus / 2).state;
    expect(progress(half)).toBeCloseTo(0.5);
  });
});
