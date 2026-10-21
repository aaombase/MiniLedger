import type { LucideIcon } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/theme/tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: "md" | "lg";
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

const palette: Record<ButtonVariant, { bg: string; pressed: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.onPrimary },
  secondary: { bg: colors.surface, pressed: colors.surfaceMuted, fg: colors.ink, border: colors.borderStrong },
  ghost: { bg: "transparent", pressed: colors.surfaceMuted, fg: colors.primary },
  danger: { bg: colors.danger, pressed: "#912018", fg: colors.onPrimary },
};

export function Button({ title, onPress, variant = "primary", size = "lg", icon: Icon, loading, disabled, fullWidth }: ButtonProps) {
  const p = palette[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={() => { if (!inactive) onPress(); }}
      disabled={disabled}
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        { height: size === "lg" ? 52 : 44, backgroundColor: pressed && !inactive ? p.pressed : p.bg },
        p.border ? { borderWidth: 1, borderColor: p.border } : null,
        fullWidth ? styles.full : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <View style={[styles.row, loading ? styles.hidden : null]}>
        {Icon ? <Icon size={20} color={p.fg} /> : null}
        <Text style={[styles.label, { color: p.fg }]}>{title}</Text>
      </View>
      {loading ? (
        <View style={styles.spinner}><ActivityIndicator size="small" color={p.fg} /></View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, flexDirection: "row" },
  full: { alignSelf: "stretch", width: "100%" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  hidden: { opacity: 0 },
  spinner: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  label: { ...typography.bodyStrong },
  disabled: { opacity: 0.5 },
});
