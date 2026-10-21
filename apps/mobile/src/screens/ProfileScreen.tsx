import { useState, type ComponentType } from "react";
import { ChevronLeft, Globe, LogOut, Phone, ShieldCheck } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { colors, fonts, layout, radii, spacing, typography } from "@/theme/tokens";
import { useAuth } from "@/auth/AuthProvider";
import { useSummary } from "@/api/queries";
import { ScreenHeader } from "@/components/ScreenHeader";
import { IconButton } from "@/components/IconButton";
import { Button } from "@/components/Button";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { formatPhoneForDisplay } from "@/shared/phone";
import { formatINR } from "@/shared/money";

export function ProfileScreen() {
  const router = useRouter();
  const auth = useAuth();
  const summary = useSummary();
  const [confirm, setConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const s = summary.data;

  return (
    <SafeAreaView style={styles.root}>
      <ScreenHeader title="Profile" left={<IconButton icon={ChevronLeft} onPress={() => router.back()} accessibilityLabel="Back" />} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.badge}>
          <Text style={styles.brand}>MiniLedger</Text>
          <Text style={styles.tag}>your pocket khata</Text>
        </View>

        <View style={styles.card}>
          <Row icon={Phone} label="Phone" value={auth.user ? formatPhoneForDisplay(auth.user.phone) : "—"} />
          <Row icon={Globe} label="Time zone" value={auth.user?.timezone ?? "—"} />
          <Row icon={ShieldCheck} label="Sign-in" value="One-time code" last />
        </View>

        {s ? (
          <View style={styles.stats}>
            <Stat label="Loans" value={String(s.counts.total)} />
            <Stat label="Lent" value={formatINR(s.totalLentMinor)} />
            <Stat label="Collected" value={formatINR(s.totalRepaidMinor)} />
          </View>
        ) : null}

        <Button title="Log out" icon={LogOut} variant="secondary" onPress={() => setConfirm(true)} fullWidth />
        <Text style={styles.version}>Version {Constants.expoConfig?.version ?? "1.0.0"}</Text>
      </ScrollView>
      <ConfirmSheet
        visible={confirm}
        title="Log out of MiniLedger?"
        body="Your loans stay safe on the server. Log in again with your phone number."
        onClose={() => setConfirm(false)}
        actions={[
          { title: "Log out", variant: "danger", loading: leaving, onPress: () => { setLeaving(true); void auth.signOut(); } },
          { title: "Cancel", variant: "secondary", onPress: () => setConfirm(false) },
        ]}
      />
    </SafeAreaView>
  );
}

function Row({ icon: Icon, label, value, last }: { icon: ComponentType<{ size: number; color: string }>; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last ? null : styles.divider]}>
      <Icon size={18} color={colors.inkMuted} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, typography.money]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.huge, gap: spacing.lg, width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  badge: { alignItems: "center", paddingVertical: spacing.xl, gap: 2 },
  brand: { fontFamily: fonts.displayBold, fontSize: 34, color: colors.primary },
  tag: { fontFamily: fonts.displayItalic, fontSize: 16, color: colors.inkMuted },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 56 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLabel: { ...typography.body, color: colors.inkMuted, flex: 1 },
  rowValue: { ...typography.label, color: colors.ink },
  stats: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.lg },
  stat: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: spacing.xs },
  statValue: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  statLabel: { ...typography.caption, color: colors.inkMuted },
  version: { ...typography.caption, color: colors.inkSubtle, textAlign: "center" },
});
