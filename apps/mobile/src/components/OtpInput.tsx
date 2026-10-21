import { useEffect, useRef, useState, type ComponentRef } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export interface OtpInputProps { value: string; onChange: (v: string) => void; onComplete: (v: string) => void; error?: boolean; autoFocus?: boolean }

export function OtpInput({ value, onChange, onComplete, error, autoFocus }: OtpInputProps) {
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  return (
    <View accessibilityLabel="One-time code" style={styles.row}>
      {Array.from({ length: 6 }, (_, i) => {
        const ch = value[i];
        const active = focused && i === Math.min(value.length, 5);
        return (
          <View key={i} style={[styles.box, ch ? styles.filled : null, active ? styles.active : null, error ? styles.error : null]}>
            <Text style={styles.digit}>{ch ?? ""}</Text>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => {
          const d = t.replace(/\D/g, "").slice(0, 6);
          onChange(d);
          if (d.length === 6) onComplete(d);
        }}
        keyboardType="number-pad"
        maxLength={6}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        accessibilityLabel="Enter 6-digit code"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.hidden}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm, justifyContent: "center", alignSelf: "center" },
  box: { width: 48, height: 56, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  filled: { borderColor: colors.borderStrong },
  active: { borderWidth: 2, borderColor: colors.primary },
  error: { borderWidth: 1.5, borderColor: colors.overdue, backgroundColor: colors.overdueSoft },
  digit: { ...typography.title, ...typography.money, color: colors.ink },
  hidden: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: colors.surface },
});
