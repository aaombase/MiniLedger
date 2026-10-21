import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export interface ChipProps { label: string; selected: boolean; onPress: () => void; dot?: string }

export function Chip({ label, selected, onPress, dot }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, selected ? styles.selected : null, pressed ? styles.pressed : null]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[styles.label, typography.money, selected ? styles.labelSel : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36, paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted,
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  selected: { backgroundColor: colors.ink },
  pressed: { opacity: 0.85 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { ...typography.label, color: colors.ink },
  labelSel: { color: colors.onPrimary },
});
