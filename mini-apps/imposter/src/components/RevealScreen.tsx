import { useCallback, useEffect, useRef, useState } from "react";
import type { Round } from "../session/session.js";

/** How long the answer pad has to be held. Long enough that a mis-tap fails. */
const HOLD_MS = 1000;

interface RevealScreenProps {
  round: Round;
  onNewRound: () => void;
  onEditPlayers: () => void;
}

/**
 * The authoritative verdict, so the table does not have to trust a confession.
 *
 * Reaching it takes a sustained hold rather than a tap: the answer is the one
 * thing on this screen nobody can un-see, so a thumb brushing the glass
 * mid-argument must not be enough to produce it.
 */
export function RevealScreen({
  round,
  onNewRound,
  onEditPlayers,
}: RevealScreenProps) {
  const [revealed, setRevealed] = useState(false);
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHold = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setHolding(false);
  }, []);

  const beginHold = useCallback(() => {
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      setRevealed(true);
    }, HOLD_MS);
  }, []);

  useEffect(() => cancelHold, [cancelHold]);

  // Losing focus mid-hold counts as letting go, so a pocketed phone cannot
  // finish the hold on its own.
  useEffect(() => {
    if (!holding) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") cancelHold();
    };
    window.addEventListener("blur", cancelHold);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", cancelHold);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [holding, cancelHold]);

  if (!revealed) {
    return (
      <main className="reveal">
        <p className="reveal-label">The answer</p>
        <button
          type="button"
          className="hold-pad"
          data-holding={holding ? "yes" : "no"}
          aria-label="Hold to reveal the answer"
          onPointerDown={beginHold}
          onPointerUp={cancelHold}
          onPointerCancel={cancelHold}
          onPointerLeave={cancelHold}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span className="hold-pad-label">Hold to reveal</span>
          <span className="hold-pad-fill" aria-hidden="true" />
        </button>
        <p className="hint">Keep holding for a second. Let go to cancel.</p>
      </main>
    );
  }

  const imposters = round.imposterIndices.map((index) => round.players[index]);

  return (
    <main className="reveal">
      <p className="reveal-label">
        {imposters.length === 1 ? "The imposter was" : "The imposters were"}
      </p>
      <h2 className="reveal-imposter">{imposters.join(", ")}</h2>
      <p className="reveal-label">The word was</p>
      <strong className="reveal-word">{round.word}</strong>
      <p className="reveal-hint">
        Their hint was &#8220;{round.hint}&#8221;
      </p>
      <div className="reveal-actions">
        <button type="button" className="btn btn-primary" onClick={onNewRound}>
          New round
        </button>
        <button type="button" className="btn btn-quiet" onClick={onEditPlayers}>
          Edit players
        </button>
      </div>
    </main>
  );
}
