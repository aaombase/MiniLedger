import type { LucideIcon } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/theme/tokens";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: { title: string; onPress: () => void; variant?: "primary" | "secondary" };
  tone?: "primary" | "muted";
}

export function EmptyState({ icon: Icon, title, body, action, tone = "primary" }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.circle, tone === "muted" ? styles.circleMuted : null]}>
        <Icon size={36} color={tone === "muted" ? colors.inkMuted : colors.primary} />
      </View>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {action ? <View style={styles.action}><Button title={action.title} onPress={action.onPress} variant={action.variant ?? "primary"} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: spacing.huge, paddingHorizontal: spacing.xxl, gap: spacing.md },
  circle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  circleMuted: { backgroundColor: colors.surfaceMuted },
  title: { ...typography.heading, color: colors.ink, textAlign: "center" },
  body: { ...typography.body, color: colors.inkMuted, textAlign: "center", maxWidth: 280 },
  action: { marginTop: spacing.sm },
});
