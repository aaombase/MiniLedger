import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, layout } from "@/theme/tokens";

export interface ScreenProps { children: ReactNode; scroll?: boolean; padded?: boolean; bottom?: ReactNode }

export function Screen({ children, scroll, padded = true, bottom }: ScreenProps) {
  const body = <View style={[styles.content, padded ? styles.padded : null]}>{children}</View>;
  return (
    <SafeAreaView style={styles.root}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>{body}</ScrollView> : <View style={styles.flex}>{body}</View>}
      {bottom}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  padded: { paddingHorizontal: layout.screenPadding },
});
