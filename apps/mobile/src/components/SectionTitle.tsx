import { ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, spacing, typography } from "@/theme/tokens";

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} style={({ pressed }) => [styles.action, pressed ? { opacity: 0.6 } : null]} accessibilityLabel={action}>
          <Text style={styles.actionText}>{action}</Text>
          <ChevronRight size={14} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: colors.ink },
  action: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 32 },
  actionText: { ...typography.label, color: colors.primary },
});
