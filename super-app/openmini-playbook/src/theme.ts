import { useColorScheme } from "react-native";

/**
 * The launcher's own chrome palette. Mini-apps theme themselves — they ask the
 * host for `theme` over the bridge and swap their CSS variables — so this only
 * covers the native shell around them: the home grid, and the modal frame a
 * mini-app is mounted in. Keeping both on `useColorScheme()` is what stops a
 * dark mini-app from opening inside a blazing white launcher.
 */
export interface Palette {
  screen: string;
  surface: string;
  text: string;
  muted: string;
  skeleton: string;
  accent: string;
  onAccent: string;
  danger: string;
}

const light: Palette = {
  screen: "#f2f2f7",
  surface: "#ffffff",
  text: "#1c1c1e",
  muted: "#6e6e73",
  skeleton: "#d8d8dc",
  accent: "#1f6feb",
  onAccent: "#ffffff",
  danger: "#c1121f",
};

const dark: Palette = {
  screen: "#000000",
  surface: "#1c1c1e",
  text: "#f2f2f7",
  muted: "#98989f",
  skeleton: "#2c2c2e",
  accent: "#4f8ef7",
  onAccent: "#ffffff",
  danger: "#ff6b6b",
};

export function useTheme(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}
