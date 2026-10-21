import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, typography } from "@/theme/tokens";
import { Button, type ButtonVariant } from "./Button";

export interface SheetAction { title: string; variant: ButtonVariant; onPress: () => void; loading?: boolean }
export interface ConfirmSheetProps { visible: boolean; title: string; body?: string; actions: SheetAction[]; onClose: () => void }

export function ConfirmSheet({ visible, title, body, actions, onClose }: ConfirmSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.panel, { paddingBottom: spacing.xl + insets.bottom }]}>
          <View style={styles.grabber} />
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}
          <View style={styles.actions}>
            {actions.map((a) => (
              <Button key={a.title} title={a.title} variant={a.variant} onPress={a.onPress} loading={a.loading} fullWidth />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  panel: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, gap: spacing.sm },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md },
  title: { ...typography.heading, color: colors.ink },
  body: { ...typography.body, color: colors.inkMuted },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
