import {
  windowLabel,
  type DayWindow,
  type Feed,
  type Story,
} from "../feed/feed.js";
import type { WindowState } from "../feed/useFeed.js";
import { usePreviews, type PreviewState } from "../feed/usePreviews.js";
import type { CatchUp } from "../prefs/catchup.js";
import { CatchUpBanner } from "./CatchUpBanner.js";
import { DayChips } from "./DayChips.js";
import { HighlightCard } from "./HighlightCard.js";
import { StorySection } from "./StorySection.js";

interface FeedScreenProps {
  windows: readonly DayWindow[];
  selected: DayWindow;
  onSelect: (daysAgo: number) => void;
  state: WindowState;
  feed: Feed;
  keywords: readonly string[];
  catchUp: CatchUp | null;
  onRetry: () => void;
}

/** The digest: chips, an optional catch-up line, then the ranked window. */
export function FeedScreen({
  windows,
  selected,
  onSelect,
  state,
  feed,
  keywords,
  catchUp,
  onRetry,
}: FeedScreenProps) {
  const previews = usePreviews();
  return (
    <main className="feed">
      <DayChips
        windows={windows}
        selected={selected.daysAgo}
        unseen={catchUp?.unseenDaysAgo ?? []}
        onSelect={onSelect}
      />
      {catchUp === null ? null : <CatchUpBanner {...catchUp} />}
      <div aria-live="polite">
        <WindowBody
          state={state}
          feed={feed}
          keywords={keywords}
          label={windowLabel(selected.daysAgo)}
          onRetry={onRetry}
          previewOf={previews.stateOf}
          onRequestPreview={previews.request}
        />
      </div>
    </main>
  );
}

interface WindowBodyProps {
  state: WindowState;
  feed: Feed;
  keywords: readonly string[];
  label: string;
  onRetry: () => void;
  previewOf: (story: Story) => PreviewState;
  onRequestPreview: (story: Story) => void;
}

function WindowBody({
  state,
  feed,
  keywords,
  label,
  onRetry,
  previewOf,
  onRequestPreview,
}: WindowBodyProps) {
  if (state.status === "loading") {
    return <p className="micro status">Loading</p>;
  }
  if (state.status === "error") {
    return (
      <div className="error-row" role="alert">
        <span>{state.message}</span>
        <button type="button" className="btn-ghost" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }
  if (feed.highlight === null) {
    return <p className="micro status">Nothing in this window</p>;
  }
  // With no keyword matches the split has nothing to say, so the list is flat.
  const split = feed.forYou.length > 0;
  return (
    <>
      <HighlightCard
        story={feed.highlight}
        keywords={keywords}
        preview={previewOf(feed.highlight)}
        onRequestPreview={onRequestPreview}
      />
      <StorySection
        label="For you"
        stories={feed.forYou}
        keywords={keywords}
        previewOf={previewOf}
        onRequestPreview={onRequestPreview}
      />
      <StorySection
        label={split ? alsoLabel(label) : null}
        stories={feed.rest}
        keywords={keywords}
        previewOf={previewOf}
        onRequestPreview={onRequestPreview}
      />
    </>
  );
}

function alsoLabel(label: string): string {
  return label === "Today" || label === "Yesterday"
    ? `Also ${label.toLowerCase()}`
    : "Also that day";
}
