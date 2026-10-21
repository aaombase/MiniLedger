import type { LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, layout } from "@/theme/tokens";

export interface IconButtonProps {
  icon: LucideIcon;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: "plain" | "filled";
  color?: string;
}

export function IconButton({ icon: Icon, onPress, accessibilityLabel, variant = "plain", color = colors.ink }: IconButtonProps) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={accessibilityLabel} style={styles.touch} hitSlop={4}>
      {({ pressed }) => (
        <View style={[styles.circle, variant === "filled" ? styles.filled : null, pressed ? styles.pressed : null]}>
          <Icon size={20} color={color} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: { width: layout.minTouch, height: layout.minTouch, alignItems: "center", justifyContent: "center" },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  filled: { backgroundColor: colors.surfaceMuted },
  pressed: { backgroundColor: colors.border },
});
