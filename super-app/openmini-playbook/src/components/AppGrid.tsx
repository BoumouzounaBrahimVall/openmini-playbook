import { useEffect, useRef } from "react";
import {
  Animated,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
} from "react-native";
import type { MiniAppEntry } from "../api/launcher";

const COLUMNS = 4;
const GRID_PADDING = 20;
const CELL_GAP = 18;
/** iOS-style corner radius as a fraction of the icon size. */
const RADIUS_RATIO = 0.22;

function useIconSize(): number {
  const { width } = useWindowDimensions();
  const usable = Math.min(width, 500) - GRID_PADDING * 2;
  return (usable - CELL_GAP * (COLUMNS - 1)) / COLUMNS;
}

interface AppGridProps {
  apps: MiniAppEntry[];
  onOpen: (app: MiniAppEntry) => void;
}

export function AppGrid({ apps, onOpen }: AppGridProps) {
  const size = useIconSize();
  return (
    <FlatList
      data={apps}
      keyExtractor={(app) => app.id}
      numColumns={COLUMNS}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.name}`}
          onPress={() => onOpen(item)}
          style={({ pressed }) => [
            styles.cell,
            { width: size },
            pressed && styles.pressed,
          ]}
        >
          <Image
            source={{ uri: `data:image/png;base64,${item.icon}` }}
            style={{
              width: size,
              height: size,
              borderRadius: size * RADIUS_RATIO,
            }}
          />
          <Text style={styles.label} numberOfLines={1}>
            {item.name}
          </Text>
        </Pressable>
      )}
    />
  );
}

export function SkeletonGrid() {
  const size = useIconSize();
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <FlatList
      data={Array.from({ length: 8 }, (_, i) => i)}
      keyExtractor={(i) => String(i)}
      numColumns={COLUMNS}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      renderItem={() => (
        <Animated.View style={[styles.cell, { width: size, opacity: pulse }]}>
          <Animated.View
            style={[
              styles.skeletonIcon,
              { width: size, height: size, borderRadius: size * RADIUS_RATIO },
            ]}
          />
          <Animated.View
            style={[styles.skeletonLabel, { width: size * 0.7 }]}
          />
        </Animated.View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    padding: GRID_PADDING,
    gap: CELL_GAP,
  },
  row: {
    gap: CELL_GAP,
  },
  cell: {
    alignItems: "center",
    gap: 6,
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.95 }],
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    color: "#3a3a3c",
    maxWidth: "100%",
  },
  skeletonIcon: {
    backgroundColor: "#d8d8dc",
  },
  skeletonLabel: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "#d8d8dc",
  },
});
