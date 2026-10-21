import { AlertCircle } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/theme/tokens";

export function FieldMessage({ error, helper }: { error?: string; helper?: string }) {
  if (error) {
    return (
      <View style={styles.row} accessibilityRole="alert">
        <AlertCircle size={14} color={colors.danger} />
        <Text style={[styles.text, { color: colors.danger }]}>{error}</Text>
      </View>
    );
  }
  if (!helper) return null;
  return <Text style={styles.text}>{helper}</Text>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  text: { ...typography.caption, color: colors.inkSubtle, flexShrink: 1 },
});
