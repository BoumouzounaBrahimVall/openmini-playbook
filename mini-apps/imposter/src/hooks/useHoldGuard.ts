import { useEffect } from "react";

/**
 * Treat losing the foreground as letting go of a press-and-hold.
 *
 * A hold is the only thing keeping a secret (or a pending reveal) on screen,
 * and the events that end a hold normally are pointer events — none of which
 * arrive when the app is backgrounded, a system dialog steals focus, or the tab
 * goes hidden with a finger still down. Without this, a pocketed phone would be
 * left holding, and a call mid-peek could leave a secret up.
 *
 * `onInterrupt` is the *interrupted* path only. A deliberate `pointerup` stays
 * on the caller's own handler, because letting go on purpose may do more than
 * this does — in the pass loop it also advances to the next player, which an
 * interruption must never do.
 *
 * Nothing is registered while `holding` is false, so an idle screen carries no
 * listeners at all.
 */
export function useHoldGuard(holding: boolean, onInterrupt: () => void): void {
  useEffect(() => {
    if (!holding) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onInterrupt();
    };
    window.addEventListener("blur", onInterrupt);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", onInterrupt);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [holding, onInterrupt]);
}
