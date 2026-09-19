import { useEffect } from "react";
import { matchedKeywords, type Story } from "../feed/feed.js";
import type { PreviewState } from "../feed/usePreviews.js";
import { StoryDetail } from "./StoryDetail.js";
import { StoryMeta } from "./StoryMeta.js";

interface HighlightCardProps {
  story: Story;
  keywords: readonly string[];
  preview: PreviewState;
  onRequestPreview: (story: Story) => void;
}

/**
 * The top-scoring story of the window, set in display size. Its preview is
 * requested as soon as it is shown: one request per window is well within
 * the reader's limit and the card is what the eye lands on.
 */
export function HighlightCard({
  story,
  keywords,
  preview,
  onRequestPreview,
}: HighlightCardProps) {
  useEffect(() => {
    onRequestPreview(story);
  }, [story, onRequestPreview]);

  return (
    <article className="highlight">
      <p className="micro">Top story</p>
      <h2 className="highlight-title">{story.title}</h2>
      <StoryMeta
        story={story}
        matched={matchedKeywords(story.title, story.url, keywords)}
      />
      <StoryDetail story={story} preview={preview} />
    </article>
  );
}
