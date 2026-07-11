/**
 * Launcher endpoint client: fetches the catalog `{ "provider-url", "mini-apps" }`
 * that drives the home grid. The URL comes from EXPO_PUBLIC_APPS_URL in .env.
 */

export interface MiniAppEntry {
  id: string;
  /** Base64-encoded PNG/JPEG, rendered as a data URI. */
  icon: string;
  name: string;
}

export interface LauncherCatalog {
  providerUrl: string;
  miniApps: MiniAppEntry[];
}

export function getAppsUrl(): string {
  const url = process.env.EXPO_PUBLIC_APPS_URL;
  if (!url) {
    throw new Error("EXPO_PUBLIC_APPS_URL is not configured — check .env");
  }
  return url;
}

function isMiniAppEntry(value: unknown): value is MiniAppEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    entry.id.length > 0 &&
    typeof entry.icon === "string" &&
    typeof entry.name === "string" &&
    entry.name.length > 0
  );
}

/** Narrow the raw endpoint payload; throws with a readable message on bad data. */
export function parseCatalog(payload: unknown): LauncherCatalog {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Launcher endpoint returned a non-object payload");
  }
  const record = payload as Record<string, unknown>;
  const providerUrl = record["provider-url"];
  const miniApps = record["mini-apps"];
  if (typeof providerUrl !== "string" || providerUrl.length === 0) {
    throw new Error('Launcher payload is missing "provider-url"');
  }
  if (!Array.isArray(miniApps) || !miniApps.every(isMiniAppEntry)) {
    throw new Error('Launcher payload has an invalid "mini-apps" array');
  }
  return { providerUrl, miniApps };
}

export async function fetchCatalog(
  signal?: AbortSignal,
): Promise<LauncherCatalog> {
  const response = await fetch(getAppsUrl(), { signal });
  if (!response.ok) {
    throw new Error(`Launcher endpoint responded with HTTP ${response.status}`);
  }
  return parseCatalog(await response.json());
}
