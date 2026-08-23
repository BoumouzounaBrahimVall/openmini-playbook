interface RoundReadyScreenProps {
  starter: string;
  /** Opens the reveal screen, which then demands a deliberate hold. */
  onOpenReveal: () => void;
}

/**
 * Everyone has looked. The app names who speaks first, states the direction of
 * play, and then gets out of the way: the discussion is the actual game, so
 * nothing else is on screen. The only control is the door to the reveal, and it
 * only opens the reveal screen — the answer itself still costs a long hold.
 */
export function RoundReadyScreen({
  starter,
  onOpenReveal,
}: RoundReadyScreenProps) {
  return (
    <main className="ready">
      <p className="ready-label">Everyone has their secret</p>
      <h2 className="ready-starter">{starter} starts</h2>
      <p className="ready-direction">Play continues clockwise.</p>
      <button type="button" className="btn btn-quiet" onClick={onOpenReveal}>
        Done arguing
      </button>
    </main>
  );
}
