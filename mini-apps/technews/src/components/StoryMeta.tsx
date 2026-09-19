import type { Story } from "../feed/feed.js";

interface StoryMetaProps {
  story: Story;
  matched: readonly string[];
}

/** For display only; matching keeps `www.` and lives in feed.ts. */
function displayHost(url: string | null): string | null {
  if (url === null) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Points, comments and the source, in monospace so the columns line up. */
export function StoryMeta({ story, matched }: StoryMetaProps) {
  const host = displayHost(story.url);
  return (
    <div className="story-meta">
      <span className="story-num">
        {story.points}
        <span className="story-unit"> pts</span>
      </span>
      <span className="story-num">
        {story.comments}
        <span className="story-unit"> cmts</span>
      </span>
      <span className="story-host">{host ?? `by ${story.author}`}</span>
      {matched.map((keyword) => (
        <span key={keyword} className="story-tag">
          {keyword}
        </span>
      ))}
    </div>
  );
}
