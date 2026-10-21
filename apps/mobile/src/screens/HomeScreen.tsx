import { useMemo, useState, type ComponentType } from "react";
import { BellRing, HandCoins, Plus, ReceiptIndianRupee, UserRound } from "lucide-react-native";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fonts, layout, radii, spacing, typography } from "@/theme/tokens";
import { useActivity, useLoans, useSummary } from "@/api/queries";
import { SummaryCard } from "@/components/SummaryCard";
import { LoanCard, LoanCardSkeleton } from "@/components/LoanCard";
import { SectionTitle } from "@/components/SectionTitle";
import { ActivityRow } from "@/components/ActivityRow";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Banner } from "@/components/Banner";
import { LoanPickerSheet } from "@/components/LoanPickerSheet";
import { useToast } from "@/components/ToastProvider";
import { sendReminder } from "@/lib/remind";
import { formatWeekdayDate } from "@/shared/dates";
import type { Loan } from "@/shared/types";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function HomeScreen() {
  const router = useRouter();
  const toast = useToast();
  const summary = useSummary();
  const loans = useLoans("all");
  const activity = useActivity(100);
  const [picking, setPicking] = useState(false);

  const all = loans.data?.loans ?? [];
  const attention = useMemo(() => all.filter((l) => l.status === "overdue" || l.status === "due_soon").slice(0, 4), [all]);
  const recent = (activity.data?.items ?? []).slice(0, 5);
  const refreshing = (summary.isRefetching || loans.isRefetching || activity.isRefetching) && !summary.isLoading;
  const refetch = () => { void summary.refetch(); void loans.refetch(); void activity.refetch(); };

  const hardError = !summary.data && !loans.data && (summary.isError || loans.isError);
  const hasAny = (summary.data?.counts.total ?? 0) > 0;

  async function remind(loan: Loan) {
    try { await sendReminder([loan]); } catch { toast.show({ message: "Couldn't open the share sheet", tone: "error" }); }
  }

  if (hardError) {
    return <SafeAreaView style={styles.root}><ErrorState onRetry={refetch} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.date}>{summary.data ? formatWeekdayDate(summary.data.asOf) : " "}</Text>
            <Text style={styles.hello} accessibilityRole="header">{greeting()}</Text>
          </View>
          <Pressable onPress={() => router.push("/profile")} accessibilityLabel="Profile" style={({ pressed }) => [styles.profile, pressed ? { opacity: 0.7 } : null]}>
            <UserRound size={20} color={colors.ink} />
          </Pressable>
        </View>

        {summary.isError && summary.data ? <Banner tone="warning" message="Couldn't refresh. Showing saved data." action={{ title: "Retry", onPress: refetch }} /> : null}

        <SummaryCard summary={summary.data} loading={summary.isLoading} />

        <View style={styles.actions}>
          <Action icon={Plus} label="Lend" onPress={() => router.push("/loans/new")} primary />
          <Action icon={HandCoins} label="Got paid" onPress={() => setPicking(true)} disabled={!hasAny} />
          <Action icon={BellRing} label="Remind" onPress={() => router.push({ pathname: "/loans", params: { filter: "overdue" } })} disabled={!hasAny} />
          <Action icon={ReceiptIndianRupee} label="Activity" onPress={() => router.push("/activity")} disabled={!hasAny} />
        </View>

        {loans.isLoading ? (
          <View>{[0, 1, 2].map((i) => <LoanCardSkeleton key={i} />)}</View>
        ) : !hasAny ? (
          <EmptyState
            icon={HandCoins}
            title="Your khata is empty"
            body="Lent money to a friend? Note it here and MiniLedger will remember who owes you."
            action={{ title: "Record your first loan", onPress: () => router.push("/loans/new") }}
          />
        ) : (
          <>
            <SectionTitle title="Needs attention" action={attention.length ? "All loans" : undefined} onAction={() => router.push("/loans")} />
            {attention.length === 0 ? (
              <View style={styles.calm}>
                <Text style={styles.calmTitle}>All calm 🌿</Text>
                <Text style={styles.calmBody}>Nothing overdue or due in the next 3 days.</Text>
              </View>
            ) : (
              attention.map((loan) => (
                <View key={loan.id}>
                  <LoanCard loan={loan} onPress={() => router.push(`/loans/${loan.id}`)} />
                  <Pressable onPress={() => void remind(loan)} style={({ pressed }) => [styles.remind, pressed ? { opacity: 0.6 } : null]} accessibilityLabel={`Remind ${loan.friendName}`}>
                    <BellRing size={13} color={colors.primary} />
                    <Text style={styles.remindText}>Send {loan.friendName.split(" ")[0]} a reminder</Text>
                  </Pressable>
                </View>
              ))
            )}

            <SectionTitle title="Recent activity" action="See all" onAction={() => router.push("/activity")} />
            <View style={styles.activityCard}>
              {recent.map((item) => (
                <ActivityRow key={item.id} item={item} onPress={() => router.push(`/loans/${item.loanId}`)} />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <LoanPickerSheet
        visible={picking}
        loans={all}
        onClose={() => setPicking(false)}
        onPick={(loan) => { setPicking(false); router.push(`/loans/${loan.id}/pay`); }}
      />
    </SafeAreaView>
  );
}

function Action({ icon: Icon, label, onPress, primary, disabled }: { icon: ComponentType<{ size: number; color: string }>; label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, disabled ? { opacity: 0.4 } : null, pressed ? { transform: [{ scale: 0.96 }] } : null]}
    >
      <View style={[styles.actionIcon, primary ? styles.actionPrimary : null]}>
        <Icon size={22} color={primary ? colors.onPrimary : colors.primary} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.huge, gap: spacing.lg, width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingTop: spacing.md },
  date: { ...typography.overline, color: colors.inkSubtle },
  hello: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: colors.ink, marginTop: 2 },
  profile: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", justifyContent: "space-between" },
  action: { alignItems: "center", gap: 6, width: 72 },
  actionIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionLabel: { ...typography.caption, fontFamily: fonts.bodySemi, color: colors.ink },
  calm: { backgroundColor: colors.primarySoft, borderRadius: radii.lg, padding: spacing.lg, gap: 2 },
  calmTitle: { ...typography.bodyStrong, color: colors.primary },
  calmBody: { ...typography.caption, color: colors.inkMuted },
  remind: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end", paddingVertical: 4, paddingHorizontal: spacing.xs, marginTop: -2, marginBottom: 4 },
  remindText: { ...typography.caption, fontFamily: fonts.bodyBold, color: colors.primary },
  activityCard: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
});
