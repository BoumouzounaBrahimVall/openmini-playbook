import { useCallback, useRef, useState } from "react";
import { fetchPreview } from "./fetchPreview.js";
import type { Preview } from "./preview.js";
import type { Story } from "./feed.js";

export type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; preview: Preview | null };

const IDLE: PreviewState = { status: "idle" };

interface UsePreviews {
  stateOf: (story: Story) => PreviewState;
  /** Fetch once per story; later calls for the same story are no-ops. */
  request: (story: Story) => void;
}

/**
 * Per-story preview cache for the session. Requests are on demand, one per
 * tapped story, to stay well inside the reader's rate limit.
 */
export function usePreviews(): UsePreviews {
  const [cache, setCache] = useState<ReadonlyMap<string, PreviewState>>(
    () => new Map(),
  );
  const requested = useRef<ReadonlySet<string>>(new Set());

  const stateOf = useCallback(
    (story: Story) => cache.get(story.id) ?? IDLE,
    [cache],
  );

  const request = useCallback((story: Story) => {
    if (story.url === null || requested.current.has(story.id)) return;
    requested.current = new Set([...requested.current, story.id]);
    setCache((current) => withEntry(current, story.id, { status: "loading" }));
    void fetchPreview(story.url).then((preview) => {
      setCache((current) =>
        withEntry(current, story.id, { status: "done", preview }),
      );
    });
  }, []);

  return { stateOf, request };
}

function withEntry(
  cache: ReadonlyMap<string, PreviewState>,
  key: string,
  value: PreviewState,
): ReadonlyMap<string, PreviewState> {
  return new Map([...cache, [key, value]]);
}
