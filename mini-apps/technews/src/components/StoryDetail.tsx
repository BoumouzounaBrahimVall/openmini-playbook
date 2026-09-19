import { useState } from "react";
import type { Story } from "../feed/feed.js";
import { openLink } from "../feed/openLink.js";
import { hnItemUrl } from "../feed/preview.js";
import type { PreviewState } from "../feed/usePreviews.js";

interface StoryDetailProps {
  story: Story;
  preview: PreviewState;
}

/**
 * What a story shows once opened: the post body for a text post or the
 * article's description and social image for a link, then the two ways out
 * to the system browser. Every part is optional except the buttons.
 */
export function StoryDetail({ story, preview }: StoryDetailProps) {
  const [failure, setFailure] = useState<string | null>(null);

  async function open(url: string) {
    const result = await openLink(url);
    setFailure(result.ok ? null : result.message);
  }

  const description =
    story.text ??
    (preview.status === "done" ? preview.preview?.description ?? null : null);
  const image =
    preview.status === "done" ? preview.preview?.image ?? null : null;

  return (
    <div className="story-detail">
      {image === null ? null : (
        <img
          className="story-image"
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
        />
      )}
      {preview.status === "loading" ? (
        <p className="micro">Loading preview</p>
      ) : null}
      {description === null ? null : (
        <p className="story-description">{description}</p>
      )}
      <div className="story-actions">
        {story.url === null ? null : (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void open(story.url ?? "")}
          >
            Open
          </button>
        )}
        <button
          type="button"
          className="btn-ghost"
          onClick={() => void open(hnItemUrl(story.id))}
        >
          {String(story.comments)} comments
        </button>
        {failure === null ? null : (
          <span className="story-failure" role="alert">
            {failure}
          </span>
        )}
      </div>
    </div>
  );
}
