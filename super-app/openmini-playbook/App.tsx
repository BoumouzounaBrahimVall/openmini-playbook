import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  fetchCatalog,
  type LauncherCatalog,
  type MiniAppEntry,
} from "./src/api/launcher";
import { AppGrid, SkeletonGrid } from "./src/components/AppGrid";
import { MiniAppModal } from "./src/components/MiniAppModal";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; catalog: LauncherCatalog };

export default function App() {
  const [load, setLoad] = useState<LoadState>({ phase: "loading" });
  const [openApp, setOpenApp] = useState<MiniAppEntry | null>(null);

  const refresh = useCallback(() => {
    setLoad({ phase: "loading" });
    fetchCatalog()
      .then((catalog) => setLoad({ phase: "ready", catalog }))
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Unexpected error";
        console.error("openmini-playbook: catalog fetch failed", error);
        setLoad({ phase: "error", message });
      });
  }, []);

  useEffect(refresh, [refresh]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>OpenMini Playbook</Text>
        <Text style={styles.subtitle}>Your mini apps</Text>
      </View>

      {load.phase === "loading" && <SkeletonGrid />}

      {load.phase === "error" && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Couldn’t load your apps</Text>
          <Text style={styles.errorDetail}>{load.message}</Text>
          <Pressable style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        </View>
      )}

      {load.phase === "ready" && (
        <>
          <AppGrid apps={load.catalog.miniApps} onOpen={setOpenApp} />
          <MiniAppModal
            providerUrl={load.catalog.providerUrl}
            app={openApp}
            onClose={() => setOpenApp(null)}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f2f2f7",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 4,
    gap: 2,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1c1c1e",
  },
  subtitle: {
    fontSize: 14,
    color: "#6e6e73",
  },
  errorBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1c1c1e",
  },
  errorDetail: {
    fontSize: 13,
    color: "#6e6e73",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 10,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#1f6feb",
  },
  retryLabel: {
    color: "#fff",
    fontWeight: "600",
  },
});
