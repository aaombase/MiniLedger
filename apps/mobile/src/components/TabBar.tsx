import { useEffect, useState } from "react";
import { BookOpen, ChartPie, House, Plus, Users, type LucideIcon } from "lucide-react-native";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, fonts, shadows, spacing } from "@/theme/tokens";
import { haptics } from "@/platform/haptics";

const ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  index: { icon: House, label: "Home" },
  loans: { icon: BookOpen, label: "Khata" },
  people: { icon: Users, label: "People" },
  insights: { icon: ChartPie, label: "Insights" },
};

interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean }; navigate: (name: string) => void };
  insets: { bottom: number };
}

/** Four tabs with a raised "lend" button in the middle; hides while the keyboard is up so it never covers input. */
export function TabBar({ state, navigation, insets }: TabBarProps) {
  const router = useRouter();
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (keyboard) return null;

  const tabs = state.routes.map((route, i) => {
    const meta = ICONS[route.name];
    if (!meta) return null;
    const focused = state.index === i;
    const Icon = meta.icon;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        onPress={() => {
          const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) { haptics.selection(); navigation.navigate(route.name); }
        }}
        style={styles.tab}
      >
        <View style={[styles.pill, focused ? styles.pillOn : null]}>
          <Icon size={21} color={focused ? colors.primary : colors.inkSubtle} strokeWidth={focused ? 2.4 : 2} />
        </View>
        <Text style={[styles.label, focused ? styles.labelOn : null]}>{meta.label}</Text>
      </Pressable>
    );
  });

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {tabs.slice(0, 2)}
      <View style={styles.tab}>
        <Pressable
          onPress={() => { haptics.selection(); router.push("/loans/new"); }}
          accessibilityLabel="Lend money"
          style={({ pressed }) => [styles.fab, pressed ? { backgroundColor: colors.primaryPressed, transform: [{ scale: 0.95 }] } : null]}
        >
          <Plus size={26} color={colors.onPrimary} strokeWidth={2.6} />
        </Pressable>
      </View>
      {tabs.slice(2)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row", backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: spacing.sm, ...shadows.card,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  pill: { width: 52, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  pillOn: { backgroundColor: colors.primarySoft },
  label: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.inkSubtle },
  labelOn: { fontFamily: fonts.bodyBold, color: colors.primary },
  fab: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    marginTop: -26, borderWidth: 4, borderColor: colors.background, ...shadows.raised,
  },
});
