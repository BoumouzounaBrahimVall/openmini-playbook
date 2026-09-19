import type { Story } from "../feed/feed.js";
import type { PreviewState } from "../feed/usePreviews.js";
import { StoryRow } from "./StoryRow.js";

interface StorySectionProps {
  /** Omitted when the feed collapses to one flat list. */
  label: string | null;
  stories: readonly Story[];
  keywords: readonly string[];
  previewOf: (story: Story) => PreviewState;
  onRequestPreview: (story: Story) => void;
}

export function StorySection({
  label,
  stories,
  keywords,
  previewOf,
  onRequestPreview,
}: StorySectionProps) {
  if (stories.length === 0) return null;
  return (
    <section className="story-section">
      {label === null ? null : <p className="micro section-label">{label}</p>}
      <ul className="story-list">
        {stories.map((story) => (
          <StoryRow
            key={story.id}
            story={story}
            keywords={keywords}
            preview={previewOf(story)}
            onRequestPreview={onRequestPreview}
          />
        ))}
      </ul>
    </section>
  );
}
