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
  // The two labels are equalised by measurement, not by eye: "You are the
  // imposter" and "You are the crewmate" are both 4 words and both 20
  // characters, so the role line renders at the same width either way and its
  // silhouette tells a bystander nothing from two feet. `.secret-role` also
  // reserves a fixed one-line height, so no rewording can make this line take
  // more vertical space for one role. Re-count both strings before editing.
  const role = secret.imposter
    ? "You are the imposter"
    : "You are the crewmate";
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
