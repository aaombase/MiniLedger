import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/theme/tokens";

export interface ScreenHeaderProps { title?: string; left?: ReactNode; right?: ReactNode }

export function ScreenHeader({ title, left, right }: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.side}>{left}</View>
      {title ? <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{title}</Text> : <View style={styles.flex} />}
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm },
  side: { width: 96, flexDirection: "row", alignItems: "center" },
  right: { justifyContent: "flex-end" },
  flex: { flex: 1 },
  title: { ...typography.heading, color: colors.ink, flex: 1, textAlign: "center" },
});
