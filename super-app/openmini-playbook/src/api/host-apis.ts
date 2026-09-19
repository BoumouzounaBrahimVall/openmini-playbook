import { Linking } from "react-native";
import type { MiniAppProviderProps } from "@openmini/react-native";

/**
 * Host-defined bridge APIs (bridge-protocol §5.1). A mini-app reaches one as
 * `mini.host.invoke("<name>", payload)` and must declare `host:<name>` in its
 * manifest permissions. Keep this object a module-level constant: the
 * provider memoizes on it, so a new object per render would rebuild the host.
 */
export const hostApis: NonNullable<MiniAppProviderProps["customApis"]> = {
  /**
   * openUrl: hand a web link to the system browser. The bridge has no built-in
   * for this, and a link inside the WebView would replace the mini-app along
   * with its close button. Only http(s) is accepted, so a mini-app cannot
   * trigger arbitrary URL schemes on the device.
   */
  openUrl: async (payload) => {
    const url = readHttpUrl(payload);
    await Linking.openURL(url);
    return null;
  },
};

function readHttpUrl(payload: unknown): string {
  const url =
    typeof payload === "object" && payload !== null
      ? (payload as { url?: unknown }).url
      : undefined;
  if (typeof url !== "string") {
    throw new Error("openUrl expects { url: string }");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("openUrl: url is not a valid URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("openUrl: only http and https links can be opened");
  }
  return parsed.toString();
}
