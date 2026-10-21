import { StyleSheet, View } from "react-native";
import { colors, radii } from "@/theme/tokens";

export function ProgressBar({ value, color = colors.primary, track = colors.surfaceMuted, height = 6 }: { value: number; color?: string; track?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={[styles.track, { backgroundColor: track, height, borderRadius: height }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color, borderRadius: height }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: "100%", overflow: "hidden", borderRadius: radii.pill },
  fill: { height: "100%" },
});
