import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radii, spacing, typography } from "@/theme/tokens";

type Tone = "warning" | "danger" | "info" | "success";
const tones: Record<Tone, { bg: string; fg: string; border: string; icon: LucideIcon }> = {
  warning: { bg: colors.dueSoonSoft, fg: colors.dueSoon, border: colors.dueSoonBorder, icon: AlertTriangle },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: "#FECDCA", icon: AlertCircle },
  info: { bg: colors.primarySoft, fg: colors.primary, border: "#C5DFD2", icon: Info },
  success: { bg: colors.repaidSoft, fg: colors.repaid, border: "#E2E8F0", icon: CheckCircle2 },
};

export interface BannerProps { tone: Tone; message: string; action?: { title: string; onPress: () => void } }

export function Banner({ tone, message, action }: BannerProps) {
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <View style={[styles.wrap, { backgroundColor: t.bg, borderColor: t.border }]} accessibilityRole="alert">
      <Icon size={18} color={t.fg} />
      <Text style={[styles.text, { color: t.fg }]}>{message}</Text>
      {action ? (
        <Pressable onPress={action.onPress} style={({ pressed }) => [styles.action, pressed ? { opacity: 0.6 } : null]} accessibilityLabel={action.title}>
          <Text style={[styles.actionText, { color: t.fg }]}>{action.title}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  text: { ...typography.label, flex: 1 },
  action: { minHeight: 32, justifyContent: "center", paddingHorizontal: spacing.xs },
  actionText: { ...typography.label, fontFamily: fonts.bodyHeavy },
});
