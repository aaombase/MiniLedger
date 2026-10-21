import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, spacing, typography } from "@/theme/tokens";
import { formatINR } from "@/shared/money";
import { formatRelativeDue } from "@/shared/dates";
import type { Loan } from "@/shared/types";
import { Avatar } from "./Avatar";

/** "Who paid you?" Lists open loans, most urgent first, and hands back the one picked. */
export function LoanPickerSheet({ visible, loans, onPick, onClose }: { visible: boolean; loans: Loan[]; onPick: (loan: Loan) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const open = loans.filter((l) => l.status !== "repaid");
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.panel, { paddingBottom: spacing.lg + insets.bottom }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Who paid you?</Text>
          {open.length === 0 ? <Text style={styles.empty}>No open loans. Everyone's settled.</Text> : null}
          <ScrollView style={{ maxHeight: 420 }}>
            {open.map((l) => (
              <Pressable key={l.id} onPress={() => onPick(l)} style={({ pressed }) => [styles.row, pressed ? { backgroundColor: colors.surfaceMuted } : null]}>
                <Avatar name={l.friendName} size={36} status={l.status} />
                <View style={styles.middle}>
                  <Text style={styles.name} numberOfLines={1}>{l.friendName}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{formatRelativeDue(l)}{l.note ? ` · ${l.note}` : ""}</Text>
                </View>
                <Text style={[styles.amount, typography.money]}>{formatINR(l.remainingMinor)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  panel: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: spacing.md, paddingHorizontal: spacing.lg },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, marginBottom: spacing.sm },
  empty: { ...typography.body, color: colors.inkMuted, paddingVertical: spacing.xl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 10, paddingHorizontal: spacing.xs, borderRadius: 12 },
  middle: { flex: 1, gap: 2 },
  name: { ...typography.bodyStrong, color: colors.ink },
  meta: { ...typography.caption, color: colors.inkMuted },
  amount: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
});
