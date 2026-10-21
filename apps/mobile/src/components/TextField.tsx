import { useState, type ComponentProps, type ReactNode } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { FieldMessage } from "./FieldMessage";

type InputProps = Omit<ComponentProps<typeof TextInput>, "style" | "value" | "onChangeText">;
export interface TextFieldProps extends InputProps {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  error?: string;
  helper?: string;
  prefix?: ReactNode;
  rightLabel?: string;
}

export function TextField({ label, value, onChangeText, error, helper, prefix, rightLabel, onFocus, onBlur, multiline, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {rightLabel ? <Text style={styles.right}>{rightLabel}</Text> : null}
      </View>
      <View
        style={[
          styles.box,
          multiline ? styles.multi : null,
          focused ? styles.focused : error ? styles.error : null,
        ]}
      >
        {prefix}
        <TextInput
          {...rest}
          multiline={multiline}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={colors.inkSubtle}
          accessibilityLabel={label}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          style={[styles.input, multiline ? styles.inputMulti : null]}
        />
      </View>
      <FieldMessage error={error} helper={helper} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { ...typography.label, color: colors.ink },
  right: { ...typography.caption, color: colors.inkSubtle, ...typography.money },
  box: {
    minHeight: 52, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    flexDirection: "row", alignItems: "center", paddingHorizontal: 14,
  },
  multi: { alignItems: "flex-start", paddingVertical: spacing.md },
  focused: { borderWidth: 2, borderColor: colors.primary, paddingHorizontal: 13 },
  error: { borderWidth: 1.5, borderColor: colors.danger },
  input: { flex: 1, ...typography.body, color: colors.ink, height: 48 },
  inputMulti: { height: 72 },
});
