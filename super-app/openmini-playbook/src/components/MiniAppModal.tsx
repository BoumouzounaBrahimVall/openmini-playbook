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
import { useTheme } from "../theme";

interface MiniAppModalProps {
  providerUrl: string;
  app: MiniAppEntry | null;
  onClose: () => void;
}

/** Persistent `mini.storage` shared by every mini-app run (namespaced per appId). */
const storage = asyncStorageKv();

export function MiniAppModal({ providerUrl, app, onClose }: MiniAppModalProps) {
  const [error, setError] = useState<MiniAppError | null>(null);
  const theme = useTheme();

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
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.surface }]}
      >
        {app !== null && (
          <MiniAppProvider registryUrl={providerUrl} storage={storage}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={[styles.errorTitle, { color: theme.text }]}>
                  Couldn’t open {app.name}
                </Text>
                <Text style={[styles.errorDetail, { color: theme.muted }]}>
                  {error.message}
                </Text>
                <Pressable
                  style={[styles.closeBtn, { backgroundColor: theme.accent }]}
                  onPress={close}
                >
                  <Text style={[styles.closeLabel, { color: theme.onAccent }]}>
                    Close
                  </Text>
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
    textAlign: "center",
  },
  closeBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  closeLabel: {
    fontWeight: "600",
  },
});
