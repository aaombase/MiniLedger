import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { formatRupeeInput } from "@/shared/money";
import { FieldMessage } from "./FieldMessage";

export interface AmountFieldProps { value: string; onChangeText: (t: string) => void; onBlur?: () => void; error?: string; label?: string; helper?: string; autoFocus?: boolean }

export function AmountField({ value, onChangeText, onBlur, error, label = "Amount", helper = "Up to ₹10,00,000", autoFocus }: AmountFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused ? styles.focused : error ? styles.error : null]}>
        <Text style={styles.prefix}>₹</Text>
        <TextInput
          value={focused ? value.replace(/,/g, "") : value ? formatRupeeInput(value) : ""}
          onChangeText={(t) => onChangeText(t.replace(/[^\d.]/g, ""))}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.inkSubtle}
          accessibilityLabel="Amount in rupees"
          maxLength={13}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          style={styles.input}
        />
      </View>
      <FieldMessage error={error} helper={helper} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { ...typography.label, color: colors.ink },
  box: {
    height: 64, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, gap: spacing.sm,
  },
  focused: { borderWidth: 2, borderColor: colors.primary, paddingHorizontal: 15 },
  error: { borderWidth: 1.5, borderColor: colors.danger },
  prefix: { ...typography.title, color: colors.inkSubtle },
  input: { flex: 1, ...typography.title, ...typography.money, color: colors.ink, height: 56 },
});
