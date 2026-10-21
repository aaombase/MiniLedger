import { Search, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { colors, fonts, radii, spacing } from "@/theme/tokens";

export function SearchBar({ value, onChangeText, placeholder }: { value: string; onChangeText: (t: string) => void; placeholder: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.box, focused ? styles.focused : null]}>
      <Search size={18} color={focused ? colors.primary : colors.inkSubtle} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSubtle}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel={placeholder}
        style={styles.input}
      />
      {value ? (
        <Pressable onPress={() => onChangeText("")} hitSlop={10} accessibilityLabel="Clear search">
          <X size={18} color={colors.inkMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 46, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: 14,
    backgroundColor: colors.surface, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border,
  },
  focused: { borderColor: colors.primary },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink, paddingVertical: 0, height: 44 },
});
