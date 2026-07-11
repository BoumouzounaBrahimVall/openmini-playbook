import { useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  MiniAppProvider,
  MiniAppView,
  type MiniAppError,
} from "@openmini/react-native";
import { asyncStorageKv } from "@openmini/react-native/async-storage";
import type { MiniAppEntry } from "../api/launcher";

interface MiniAppModalProps {
  providerUrl: string;
  app: MiniAppEntry | null;
  onClose: () => void;
}

/** Persistent `mini.storage` shared by every mini-app run (namespaced per appId). */
const storage = asyncStorageKv();

export function MiniAppModal({ providerUrl, app, onClose }: MiniAppModalProps) {
  const [error, setError] = useState<MiniAppError | null>(null);

  function close() {
    setError(null);
    onClose();
  }

  return (
    <Modal
      visible={app !== null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={close}
    >
      <SafeAreaView style={styles.container}>
        {app !== null && (
          <MiniAppProvider registryUrl={providerUrl} storage={storage}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>Couldn’t open {app.name}</Text>
                <Text style={styles.errorDetail}>{error.message}</Text>
                <Pressable style={styles.closeBtn} onPress={close}>
                  <Text style={styles.closeLabel}>Close</Text>
                </Pressable>
              </View>
            ) : (
              <MiniAppView
                appId={app.id}
                onClose={close}
                onError={setError}
                style={styles.view}
              />
            )}
          </MiniAppProvider>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  view: {
    flex: 1,
  },
  errorBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  errorDetail: {
    fontSize: 13,
    color: "#6e6e73",
    textAlign: "center",
  },
  closeBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#1f6feb",
  },
  closeLabel: {
    color: "#fff",
    fontWeight: "600",
  },
});
