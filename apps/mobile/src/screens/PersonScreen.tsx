import { useMemo } from "react";
import { BellRing, ChevronLeft, Plus, SearchX } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, fonts, layout, radii, spacing, typography } from "@/theme/tokens";
import { useLoans } from "@/api/queries";
import { ScreenHeader } from "@/components/ScreenHeader";
import { IconButton } from "@/components/IconButton";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { LoanCard } from "@/components/LoanCard";
import { ProgressBar } from "@/components/ProgressBar";
import { SectionTitle } from "@/components/SectionTitle";
import { Stamp } from "@/components/Stamp";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/ToastProvider";
import { groupByPerson } from "@/lib/people";
import { sendReminder } from "@/lib/remind";
import { formatINR } from "@/shared/money";

export function PersonScreen() {
  const { name: key } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const toast = useToast();
  const loans = useLoans("all");
  const person = useMemo(() => groupByPerson(loans.data?.loans ?? []).find((p) => p.key === key), [loans.data, key]);
  const back = <IconButton icon={ChevronLeft} onPress={() => (router.canGoBack() ? router.back() : router.replace("/people"))} accessibilityLabel="Back" />;

  if (!person) {
    return (
      <SafeAreaView style={styles.root}>
        <ScreenHeader left={back} />
        {loans.isLoading ? null : <EmptyState icon={SearchX} tone="muted" title="No loans for this person" body="They may have been deleted." />}
      </SafeAreaView>
    );
  }

  const open = person.loans.filter((l) => l.status !== "repaid");
  const settled = person.loans.filter((l) => l.status === "repaid");

  async function remind() {
    try { await sendReminder(open); } catch { toast.show({ message: "Couldn't open the share sheet", tone: "error" }); }
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScreenHeader left={back} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Avatar name={person.name} size={72} status={person.status} />
          <Text style={styles.name} accessibilityRole="header">{person.name}</Text>
          {person.owedMinor > 0 ? (
            <>
              <Text style={styles.owesLabel}>owes you</Text>
              <Text style={[styles.owes, typography.money, person.overdueMinor > 0 ? { color: colors.overdue } : null]}>{formatINR(person.owedMinor)}</Text>
              {person.overdueMinor > 0 ? <Text style={styles.overdue}>{formatINR(person.overdueMinor)} of it is overdue</Text> : null}
            </>
          ) : (
            <View style={{ marginTop: spacing.md }}><Stamp status="repaid" label="All settled" size="lg" /></View>
          )}
        </View>

        <View style={styles.stats}>
          <Stat label="Lent in total" value={formatINR(person.lentMinor)} />
          <Stat label="Returned" value={formatINR(person.paidMinor)} />
          <Stat label="Loans" value={String(person.loans.length)} />
        </View>
        <ProgressBar value={person.lentMinor ? person.paidMinor / person.lentMinor : 0} height={6} />

        <View style={styles.actions}>
          {open.length ? <View style={styles.flex}><Button title="Remind" icon={BellRing} onPress={() => void remind()} variant="secondary" fullWidth /></View> : null}
          <View style={styles.flex}>
            <Button title="Lend again" icon={Plus} onPress={() => router.push({ pathname: "/loans/new", params: { name: person.name } })} fullWidth />
          </View>
        </View>

        {open.length ? <SectionTitle title="Open" /> : null}
        {open.map((l) => <LoanCard key={l.id} loan={l} showName={false} onPress={() => router.push(`/loans/${l.id}`)} />)}
        {settled.length ? <SectionTitle title="Settled" /> : null}
        {settled.map((l) => <LoanCard key={l.id} loan={l} showName={false} onPress={() => router.push(`/loans/${l.id}`)} />)}
      </ScrollView>
    </SafeAreaView>
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
  flex: { flex: 1 },
  scroll: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.huge, gap: spacing.md, width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  hero: { alignItems: "center", paddingBottom: spacing.md },
  name: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.ink, marginTop: spacing.md, textAlign: "center" },
  owesLabel: { ...typography.overline, color: colors.inkSubtle, marginTop: spacing.md },
  owes: { fontFamily: fonts.displayBold, fontSize: 40, lineHeight: 46, color: colors.ink },
  overdue: { ...typography.label, color: colors.overdue, marginTop: 2 },
  stats: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md },
  stat: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: spacing.xs },
  statValue: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  statLabel: { ...typography.caption, color: colors.inkMuted },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
});
