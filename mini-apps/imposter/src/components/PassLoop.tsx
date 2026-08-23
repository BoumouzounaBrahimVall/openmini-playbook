import { useCallback, useEffect, useState } from "react";
import { SecretCard } from "./SecretCard.js";
import { useHoldGuard } from "../hooks/useHoldGuard.js";
import type { Round } from "../session/session.js";

interface PassLoopProps {
  round: Round;
  /** Whose turn it is — index into `round.players` / `round.secrets`. */
  index: number;
  /** Called on a deliberate release; the last player ends the pass loop. */
  onPassedOn: () => void;
}

/**
 * The per-player gate, in two steps.
 *
 * Step 1 names the player before anything is revealed, so nobody burns someone
 * else's turn. Step 2 is a press-and-hold pad: the secret exists on screen only
 * while the pointer is down, so the phone can never be handed over showing it.
 *
 * Lifting the finger off the pad is read as "done" — it hides the secret *and*
 * advances to the next player, so there is no "hide" button anyone can forget.
 * Anything that is not a deliberate lift — a system gesture cancelling the
 * pointer, the finger sliding off the pad, the app losing focus, the tab going
 * hidden — hides the secret but leaves this player's turn open, so a phone call
 * mid-peek does not cost them the round. Once they have passed on, `index` has
 * moved and their secret is unreachable.
 */
export function PassLoop({ round, index, onPassedOn }: PassLoopProps) {
  const [armed, setArmed] = useState(false);
  const [holding, setHolding] = useState(false);
  const player = round.players[index];
  const secret = round.secrets[index];

  // A new player's turn always restarts at step 1 with nothing on screen.
  useEffect(() => {
    setArmed(false);
    setHolding(false);
  }, [index]);

  /** Hide the secret but keep the turn: the peek was interrupted, not finished. */
  const abandonHold = useCallback(() => {
    setHolding(false);
  }, []);

  /** Hide the secret and hand the phone on: the peek finished deliberately. */
  const finishHold = useCallback(() => {
    setHolding(false);
    onPassedOn();
  }, [onPassedOn]);

  // A backgrounded or unfocused app must never be left with a secret up. This
  // is the interrupted path: it keeps the turn, unlike `finishHold`.
  useHoldGuard(holding, abandonHold);

  if (!armed) {
    return (
      <main className="pass">
        <p className="pass-step">
          Player {index + 1} of {round.players.length}
        </p>
        <h2 className="pass-name">Pass the phone to {player}</h2>
        <button
          type="button"
          className="btn btn-primary btn-wide"
          onClick={() => setArmed(true)}
        >
          I&#8217;m {player}
        </button>
        <p className="hint">Nobody else should be looking.</p>
      </main>
    );
  }

  return (
    <main className="pass">
      <p className="pass-step">{player}</p>
      <h2 className="pass-name">Hold to see your secret</h2>
      <button
        type="button"
        className="hold-pad"
        aria-label={`Hold to see ${player}'s secret`}
        onPointerDown={() => setHolding(true)}
        onPointerUp={() => {
          if (holding) finishHold();
        }}
        onPointerCancel={abandonHold}
        onPointerLeave={abandonHold}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span className="hold-pad-label">Hold</span>
      </button>
      <p className="hint">
        Letting go hides it and passes the phone on
        {index + 1 < round.players.length
          ? ` to ${round.players[index + 1]}.`
          : "."}
      </p>

      {holding ? (
        <div className="secret-stage">
          <SecretCard secret={secret} />
        </div>
      ) : null}
    </main>
  );
}
