import type { PlayerSecret } from "../session/session.js";

interface SecretCardProps {
  secret: PlayerSecret;
}

/**
 * The white slip that appears on the player's card while they hold it.
 *
 * Both roles render the same box, in the same place, at the same size — only
 * the text inside it differs. The imposter's text is red, deliberately: the
 * player asked for a colour they can recognise without reading, so an imposter
 * glancing down knows their role in the quarter-second they have.
 *
 * That is a knowing trade against the "layout-identical" rule this component
 * used to enforce — red is legible from further away than black, so a shoulder
 * surfer learns more from a glance than they used to. The box geometry is still
 * shared so the silhouette matches; only the colour separates the roles.
 *
 * The drawn category is not among the strings, in either branch.
 */
export function SecretCard({ secret }: SecretCardProps) {
  if (secret.imposter) {
    return (
      <div className="slip slip-imposter">
        <span className="slip-role">You are the imposter!</span>
        <strong className="slip-word">{secret.hint ?? ""}</strong>
      </div>
    );
  }

  return (
    <div className="slip">
      <strong className="slip-word">{secret.word ?? ""}</strong>
    </div>
  );
}
