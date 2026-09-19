import { mini } from "@openmini/runtime";

export type OpenResult = { ok: true } | { ok: false; message: string };

/**
 * Hands a link to the host, which opens the system browser. This is the only
 * way out of the WebView that keeps the app alive: a plain anchor would
 * replace the page and take the close button with it. Hosts without the
 * `openUrl` API answer API_NOT_FOUND, which the row reports in one line.
 */
export async function openLink(url: string): Promise<OpenResult> {
  try {
    await mini.host.invoke("openUrl", { url });
    return { ok: true };
  } catch (error: unknown) {
    console.error("technews: openUrl failed", error);
    return { ok: false, message: "This host can't open links" };
  }
}
