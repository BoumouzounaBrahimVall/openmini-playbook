import { useState } from "react";
import { matchedKeywords, type Story } from "../feed/feed.js";
import type { PreviewState } from "../feed/usePreviews.js";
import { StoryDetail } from "./StoryDetail.js";
import { StoryMeta } from "./StoryMeta.js";

interface StoryRowProps {
  story: Story;
  keywords: readonly string[];
  preview: PreviewState;
  onRequestPreview: (story: Story) => void;
}

/**
 * One story between two hairlines. A tap unfolds it in place and asks for
 * its preview; a second tap folds it back. Links never navigate the WebView.
 */
export function StoryRow({
  story,
  keywords,
  preview,
  onRequestPreview,
}: StoryRowProps) {
  const [open, setOpen] = useState(false);

  function toggle() {
    if (!open) onRequestPreview(story);
    setOpen(!open);
  }

  return (
    <li className="story-row" data-open={open ? "yes" : "no"}>
      <button
        type="button"
        className="story-toggle"
        aria-expanded={open}
        onClick={toggle}
      >
        <h3 className="story-title">{story.title}</h3>
        <StoryMeta
          story={story}
          matched={matchedKeywords(story.title, story.url, keywords)}
        />
      </button>
      {open ? <StoryDetail story={story} preview={preview} /> : null}
    </li>
  );
}
