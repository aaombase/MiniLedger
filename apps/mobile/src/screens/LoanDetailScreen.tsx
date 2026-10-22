import { useState } from "react";
import { BellRing, CheckCheck, ChevronLeft, HandCoins, MoreHorizontal, SearchX } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, fonts, layout, radii, spacing, typography } from "@/theme/tokens";
import { useDeleteLoan, useLoan, useRepayLoan } from "@/api/queries";
import { isApiError } from "@/api/ApiError";
import { haptics } from "@/platform/haptics";
import { ScreenHeader } from "@/components/ScreenHeader";
import { IconButton } from "@/components/IconButton";
import { Avatar } from "@/components/Avatar";
import { Stamp } from "@/components/Stamp";
import { ProgressBar } from "@/components/ProgressBar";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { SectionTitle } from "@/components/SectionTitle";
import { LoanProof, PaymentProof } from "@/components/PaymentProof";
import { useToast } from "@/components/ToastProvider";
import { sendReminder } from "@/lib/remind";
import { formatINR } from "@/shared/money";
import { formatDate, formatRelativeDue, formatShortDate, isoToLocalDate } from "@/shared/dates";

export function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const loanQ = useLoan(id);
  const repay = useRepayLoan();
  const del = useDeleteLoan();
  const [confirmSettle, setConfirmSettle] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menu, setMenu] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const loan = loanQ.data;
  const header = (
    <ScreenHeader
      left={<IconButton icon={ChevronLeft} onPress={goBack} accessibilityLabel="Back" />}
      right={loan ? <IconButton icon={MoreHorizontal} onPress={() => setMenu(true)} accessibilityLabel="More options" /> : null}
    />
  );

  if (loanQ.isLoading) {
    return (
      <SafeAreaView style={styles.root}>
        {header}
        <View style={styles.hero}>
          <Skeleton width={72} height={72} radius={36} />
          <Skeleton width={140} height={22} />
          <Skeleton width={180} height={44} radius={8} />
        </View>
      </SafeAreaView>
    );
  }

  if (loanQ.error || !loan) {
    const notFound = isApiError(loanQ.error) && loanQ.error.status === 404;
    return (
      <SafeAreaView style={styles.root}>
        {header}
        {notFound ? (
          <EmptyState icon={SearchX} tone="muted" title="Loan not found" body="It may have been deleted." action={{ title: "Back to khata", onPress: () => router.replace("/") }} />
        ) : (
          <ErrorState onRetry={() => void loanQ.refetch()} />
        )}
      </SafeAreaView>
    );
  }

  const repaid = loan.status === "repaid";
  const progress = loan.paidMinor / loan.amountMinor;

  async function settle() {
    try {
      await repay.mutateAsync(loan!.id);
      haptics.success();
      toast.show({ message: `${loan!.friendName.split(" ")[0]} is all settled 🎉`, tone: "success" });
    } catch (e) {
      if (isApiError(e) && e.code === "LOAN_ALREADY_REPAID") toast.show({ message: "Already settled", tone: "info" });
      else toast.show({ message: "Couldn't settle this loan. Try again.", tone: "error" });
    } finally {
      setConfirmSettle(false);
    }
  }

  async function remove() {
    try {
      await del.mutateAsync(loan!.id);
      setConfirmDelete(false);
      toast.show({ message: "Loan deleted", tone: "info" });
      goBack();
    } catch {
      setConfirmDelete(false);
      toast.show({ message: "Couldn't delete this loan. Try again.", tone: "error" });
    }
  }

  async function remind() {
    try { await sendReminder([loan!]); } catch { toast.show({ message: "Couldn't open the share sheet", tone: "error" }); }
  }


  return (
    <SafeAreaView style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Avatar name={loan.friendName} size={72} status={loan.status} />
          <Pressable onPress={() => router.push({ pathname: "/people/[name]", params: { name: loan.friendName.trim().replace(/\s+/g, " ").toLowerCase() } })}>
            <Text style={styles.name} accessibilityRole="header">{loan.friendName}</Text>
          </Pressable>
          {loan.note ? <Text style={styles.note}>“{loan.note}”</Text> : null}
          <Text style={styles.leftLabel}>{repaid ? "Lent" : loan.paidMinor > 0 ? "Still owed" : "Owes you"}</Text>
          <Text style={[styles.amount, typography.money, loan.status === "overdue" ? { color: colors.overdue } : repaid ? { color: colors.repaid } : null]}>
            {formatINR(repaid ? loan.amountMinor : loan.remainingMinor)}
          </Text>
          <View style={styles.stamp}><Stamp status={loan.status} label={repaid ? "Paid in full" : formatRelativeDue(loan).replace(" · ", " ")} size="lg" /></View>
        </View>

        <View style={styles.card}>
          <View style={styles.progressHead}>
            <Text style={styles.cardLabel}>Repayment</Text>
            <Text style={[styles.cardLabel, typography.money]}>{Math.round(progress * 100)}%</Text>
          </View>
          <ProgressBar value={progress} color={repaid ? colors.repaid : colors.primary} height={10} />
          <View style={styles.progressFoot}>
            <Text style={[styles.caption, typography.money]}>{formatINR(loan.paidMinor)} received</Text>
            <Text style={[styles.caption, typography.money]}>of {formatINR(loan.amountMinor)}</Text>
          </View>
          <View style={styles.facts}>
            <Fact label="Lent on" value={formatDate(isoToLocalDate(loan.createdAt))} />
            <Fact label="Due" value={formatDate(loan.dueDate)} tone={loan.status === "overdue" ? colors.overdue : undefined} />
            {repaid && loan.repaidAt ? <Fact label="Settled" value={formatDate(isoToLocalDate(loan.repaidAt))} /> : null}
          </View>
        </View>

        {!repaid ? (
          <View style={styles.actions}>
            <ActionButton icon={HandCoins} label="Record payment" primary onPress={() => router.push(`/loans/${loan.id}/pay`)} />
            <ActionButton icon={CheckCheck} label="Settle in full" onPress={() => setConfirmSettle(true)} />
            <ActionButton icon={BellRing} label="Remind" onPress={() => void remind()} />
          </View>
        ) : null}

        <SectionTitle title="History" />
        <View style={styles.card}>
          {loan.payments.map((p, i) => (
            <View key={p.id} style={styles.payment}>
              <View style={styles.rail}>
                <View style={[styles.dot, i === 0 && repaid ? { backgroundColor: colors.repaid } : null]} />
                <View style={styles.line} />
              </View>
              <View style={styles.paymentBody}>
                <Text style={[styles.paymentAmount, typography.money]}>+{formatINR(p.amountMinor)}</Text>
                <Text style={styles.caption}>{formatShortDate(p.paidOn)}{p.note ? ` · ${p.note}` : ""}{i === 0 && repaid ? " · settled" : ""}</Text>
              </View>
              <PaymentProof loanId={loan.id} payment={p} />
            </View>
          ))}
          {loan.payments.length === 0 ? (
            <Text style={[styles.muted, { marginBottom: spacing.md }]}>No payments yet. When {loan.friendName.split(" ")[0]} pays you back, even partly, record it here.</Text>
          ) : null}
          <View style={styles.payment}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: colors.inkMuted }]} />
            </View>
            <View style={[styles.paymentBody, { paddingBottom: 0 }]}>
              <Text style={[styles.paymentAmount, typography.money, { color: colors.ink }]}>Lent {formatINR(loan.amountMinor)}</Text>
              <Text style={styles.caption}>{formatShortDate(isoToLocalDate(loan.createdAt))}{loan.note ? ` · ${loan.note}` : ""}</Text>
            </View>
            <LoanProof loanId={loan.id} hasReceipt={loan.hasReceipt} />
          </View>
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={menu}
        title={loan.friendName}
        onClose={() => setMenu(false)}
        actions={[
          { title: "Edit details", variant: "secondary", onPress: () => { setMenu(false); router.push(`/loans/${loan.id}/edit`); } },
          { title: "Delete loan", variant: "danger", onPress: () => { setMenu(false); setConfirmDelete(true); } },
          { title: "Cancel", variant: "ghost", onPress: () => setMenu(false) },
        ]}
      />
      <ConfirmSheet
        visible={confirmSettle}
        title="Settle in full?"
        body={`Records ${formatINR(loan.remainingMinor)} from ${loan.friendName} today and closes the loan.`}
        onClose={() => { if (!repay.isPending) setConfirmSettle(false); }}
        actions={[
          { title: `Yes, received ${formatINR(loan.remainingMinor)}`, variant: "primary", loading: repay.isPending, onPress: () => void settle() },
          { title: "Cancel", variant: "secondary", onPress: () => setConfirmSettle(false) },
        ]}
      />
      <ConfirmSheet
        visible={confirmDelete}
        title="Delete this loan?"
        body="Its payments and receipt are deleted too. This can't be undone."
        onClose={() => { if (!del.isPending) setConfirmDelete(false); }}
        actions={[
          { title: "Delete", variant: "danger", loading: del.isPending, onPress: () => void remove() },
          { title: "Keep it", variant: "secondary", onPress: () => setConfirmDelete(false) },
        ]}
      />
    </SafeAreaView>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

function ActionButton({ icon: Icon, label, onPress, primary }: { icon: typeof HandCoins; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => [styles.actionBtn, primary ? styles.actionPrimary : null, pressed ? { opacity: 0.8 } : null]}>
      <Icon size={20} color={primary ? colors.onPrimary : colors.primary} />
      <Text style={[styles.actionText, primary ? { color: colors.onPrimary } : null]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.huge, gap: spacing.md, width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  hero: { alignItems: "center", paddingBottom: spacing.sm, gap: 4 },
  name: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.ink, marginTop: spacing.sm, textAlign: "center", textDecorationLine: "underline", textDecorationColor: colors.border },
  note: { fontFamily: fonts.displayItalic, fontSize: 16, color: colors.inkMuted, textAlign: "center" },
  leftLabel: { ...typography.overline, color: colors.inkSubtle, marginTop: spacing.md },
  amount: { fontFamily: fonts.displayBold, fontSize: 46, lineHeight: 54, letterSpacing: -1, color: colors.ink },
  stamp: { marginTop: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  cardLabel: { ...typography.label, color: colors.ink },
  progressHead: { flexDirection: "row", justifyContent: "space-between" },
  progressFoot: { flexDirection: "row", justifyContent: "space-between" },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg, marginTop: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  fact: { gap: 2 },
  factLabel: { ...typography.overline, fontSize: 10, color: colors.inkSubtle },
  factValue: { ...typography.label, color: colors.ink },
  caption: { ...typography.caption, color: colors.inkMuted },
  muted: { ...typography.body, color: colors.inkMuted },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionBtn: { flex: 1, minHeight: 72, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 4 },
  actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionText: { ...typography.caption, fontFamily: fonts.bodyBold, color: colors.primary },
  payment: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  rail: { width: 14, alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, marginTop: 5 },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  paymentBody: { flex: 1, paddingBottom: spacing.md, gap: 1 },
  paymentAmount: { fontFamily: fonts.display, fontSize: 17, color: colors.primary },
});
