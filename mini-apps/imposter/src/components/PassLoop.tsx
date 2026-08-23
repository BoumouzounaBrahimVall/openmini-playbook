import { useCallback, useEffect, useState } from "react";
import { SecretCard } from "./SecretCard.js";
import { useHoldGuard } from "../hooks/useHoldGuard.js";
import type { Round } from "../session/session.js";

interface PassLoopProps {
  round: Round;
  /** Whose turn it is — index into `round.players` / `round.secrets`. */
  index: number;
  /** Called when this player deliberately hands the phone on. */
  onPassedOn: () => void;
}

/**
 * Card colours, cycled by seat rather than drawn, so the colour a player gets
 * carries no information about their role. Two adjacent players never share one.
 */
const CARD_TINTS = [
  "cyan",
  "pink",
  "yellow",
  "mint",
  "lilac",
  "peach",
] as const;

/**
 * One player's card.
 *
 * The card names its owner before anything is revealed, so nobody burns someone
 * else's turn. Holding it shows the secret; letting go hides it again. The
 * secret exists on screen only while the pointer is down, which is what stops
 * the phone ever being handed over showing a word.
 *
 * Releasing does NOT advance — it just hides. Advancing is a separate, explicit
 * "Next player" tap that only appears once this player has looked at least once.
 * That means a player can re-read their secret as often as they like while it is
 * still their turn, and cannot skip a player who has not looked yet. Once the
 * turn moves on, `index` changes and the previous secret is unreachable.
 */
export function PassLoop({ round, index, onPassedOn }: PassLoopProps) {
  const [holding, setHolding] = useState(false);
  const [peeked, setPeeked] = useState(false);
  const player = round.players[index];
  const secret = round.secrets[index];
  const tint = CARD_TINTS[index % CARD_TINTS.length];

  // Every new turn starts face-down, with the pass button withheld again.
  useEffect(() => {
    setHolding(false);
    setPeeked(false);
  }, [index]);

  const release = useCallback(() => {
    setHolding(false);
  }, []);

  const grab = useCallback(() => {
    setHolding(true);
    setPeeked(true);
  }, []);

  // Losing the foreground counts as letting go: a pocketed phone must never be
  // left holding a secret open.
  useHoldGuard(holding, release);

  const isLast = index + 1 >= round.players.length;

  return (
    <main className="pass">
      <div
        className="card"
        data-tint={tint}
        data-holding={holding ? "yes" : "no"}
        role="button"
        tabIndex={0}
        aria-label={`Hold to see ${player}'s secret`}
        onPointerDown={grab}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span className="card-name">{player}</span>

        {holding ? (
          <SecretCard secret={secret} />
        ) : (
          <>
            <p className="card-warn">Do not tell the word to other players.</p>
            <span className="card-hold">
              <span className="card-hold-icon" aria-hidden="true">
                &#9757;
              </span>
              Hold to reveal
            </span>
          </>
        )}
      </div>

      {peeked && !holding ? (
        <button
          type="button"
          className="pass-next"
          onClick={onPassedOn}
        >
          <span aria-hidden="true">&#9654;&#124;</span>
          {isLast ? "Everyone has looked" : "Next player"}
        </button>
      ) : (
        <p className="pass-step">
          Player {index + 1} of {round.players.length}
        </p>
      )}
    </main>
  );
}
