import type { PlayerSecret } from "../session/session.js";

interface SecretCardProps {
  secret: PlayerSecret;
}

/**
 * The one and only renderer of a dealt secret.
 *
 * Both roles go through this exact markup and these exact classes: the same
 * three lines, in the same order, at the same type scale, inside the same
 * fixed-height frame. Nothing is conditional except the strings themselves,
 * so an imposter screen and a crew screen are indistinguishable from across
 * a table — the leak this app exists to prevent.
 *
 * The drawn category is deliberately not among the strings.
 */
export function SecretCard({ secret }: SecretCardProps) {
  // Both labels are deliberately the same shape and length, so the role line
  // itself gives nothing away to someone reading the silhouette from two feet.
  const role = secret.imposter
    ? "You are the imposter"
    : "You are one of the crew";
  // Exactly one of `hint` and `word` is set; whichever it is takes the same slot.
  const text = secret.imposter ? secret.hint : secret.word;

  return (
    <div className="secret">
      <span className="secret-role">{role}</span>
      <strong className="secret-text">{text ?? ""}</strong>
      <span className="secret-note">Let go to pass the phone on</span>
    </div>
  );
}
