import { useMemo, useState, type ComponentType } from "react";
import { ChartPie, Clock3, Hourglass, Trophy } from "lucide-react-native";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fonts, layout, radii, spacing, typography } from "@/theme/tokens";
import { useActivity, useLoans, useSummary } from "@/api/queries";
import { Donut, MonthBars } from "@/components/charts";
import { ProgressBar } from "@/components/ProgressBar";
import { SectionTitle } from "@/components/SectionTitle";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { computeInsights } from "@/lib/insights";
import { formatINR } from "@/shared/money";
import { plural } from "@/shared/dates";

export function InsightsScreen() {
  const router = useRouter();
  const summary = useSummary();
  const loans = useLoans("all");
  const activity = useActivity(500);
  const [chartWidth, setChartWidth] = useState(0);

  const today = summary.data?.asOf ?? loans.data?.asOf;
  const data = useMemo(
    () => (loans.data && activity.data && today ? computeInsights(loans.data.loans, activity.data.items, today) : null),
    [loans.data, activity.data, today],
  );
  const refetch = () => { void summary.refetch(); void loans.refetch(); void activity.refetch(); };
  const refreshing = loans.isRefetching || activity.isRefetching;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <Text style={styles.title} accessibilityRole="header">Insights</Text>

        {(loans.isError || activity.isError) && !data ? (
          <ErrorState onRetry={refetch} />
        ) : !data ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton width="100%" height={170} radius={20} />
            <Skeleton width="100%" height={220} radius={20} />
          </View>
        ) : loans.data!.loans.length === 0 ? (
          <EmptyState icon={ChartPie} tone="muted" title="Nothing to analyse yet" body="Insights appear once you've recorded a few loans." />
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.donutRow}>
                <Donut value={data.collectionRate} label="collected" color={colors.primary} />
                <View style={styles.donutSide}>
                  <Metric icon={Clock3} label="Paid back on time" value={data.onTimeRate === null ? "—" : `${Math.round(data.onTimeRate * 100)}%`} />
                  <Metric icon={Hourglass} label="Avg. days to settle" value={data.avgDaysToSettle === null ? "—" : plural(data.avgDaysToSettle, "day")} />
                  <Metric icon={Trophy} label="Loans settled" value={String(data.settledCount)} />
                </View>
              </View>
            </View>

            <SectionTitle title="Last 6 months" />
            <View style={styles.card} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width - spacing.lg * 2)}>
              {chartWidth > 0 ? <MonthBars months={data.months} width={chartWidth} /> : <View style={{ height: 190 }} />}
            </View>

            <SectionTitle title="Who owes the most" />
            <View style={styles.card}>
              {data.topOwed.length === 0 ? <Text style={styles.muted}>Nobody owes you anything right now.</Text> : null}
              {data.topOwed.map((p, i) => (
                <View key={p.key} style={[styles.owedRow, i > 0 ? styles.divider : null]} accessibilityLabel={`${p.name} owes ${formatINR(p.owedMinor)}`}>
                  <Text style={styles.rank}>{i + 1}</Text>
                  <Avatar name={p.name} size={32} status={p.status} />
                  <View style={styles.flex}>
                    <Text style={styles.owedName} onPress={() => router.push({ pathname: "/people/[name]", params: { name: p.key } })}>{p.name}</Text>
                    <ProgressBar value={p.owedMinor / data.topOwed[0]!.owedMinor} color={p.overdueMinor > 0 ? colors.overdue : colors.primary} height={5} />
                  </View>
                  <Text style={[styles.owedAmount, typography.money]}>{formatINR(p.owedMinor)}</Text>
                </View>
              ))}
            </View>

            <SectionTitle title="How late are overdue loans?" />
            <View style={styles.agingRow}>
              {data.aging.map((b, i) => (
                <View key={b.label} style={[styles.aging, { backgroundColor: [colors.dueSoonSoft, colors.overdueSoft, "#F6D3C8"][i] }]}>
                  <Text style={styles.agingLabel}>{b.label}</Text>
                  <Text style={[styles.agingValue, typography.money, { color: i === 0 ? colors.dueSoon : colors.overdue }]} numberOfLines={1} adjustsFontSizeToFit>{formatINR(b.minor)}</Text>
                  <Text style={styles.agingCount}>{plural(b.count, "loan")}</Text>
                </View>
              ))}
            </View>

            {data.largestOpen ? (
              <View style={styles.callout}>
                <Text style={styles.calloutLabel}>Largest open loan</Text>
                <Text style={styles.calloutText}>
                  {formatINR(data.largestOpen.remainingMinor)} with {data.largestOpen.friendName}
                  {data.largestOpen.note ? ` for ${data.largestOpen.note.toLowerCase()}` : ""}.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ icon: Icon, label, value }: { icon: ComponentType<{ size: number; color: string }>; label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Icon size={16} color={colors.inkMuted} />
      <View style={styles.flex}>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, gap: 5 },
  scroll: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.huge, gap: spacing.md, width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.ink, paddingTop: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  donutRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  donutSide: { flex: 1, gap: spacing.md },
  metric: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  metricValue: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22, color: colors.ink },
  metricLabel: { ...typography.caption, color: colors.inkMuted, marginTop: -4 },
  muted: { ...typography.body, color: colors.inkMuted },
  owedRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rank: { fontFamily: fonts.displayItalic, fontSize: 18, color: colors.inkSubtle, width: 16, textAlign: "center" },
  owedName: { ...typography.label, color: colors.ink },
  owedAmount: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  agingRow: { flexDirection: "row", gap: spacing.sm },
  aging: { flex: 1, borderRadius: radii.lg, padding: spacing.md, gap: 2 },
  agingLabel: { ...typography.overline, fontSize: 10, color: colors.inkMuted },
  agingValue: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24 },
  agingCount: { ...typography.caption, color: colors.inkMuted },
  callout: { backgroundColor: colors.accentSoft, borderRadius: radii.lg, padding: spacing.lg, gap: 4, borderLeftWidth: 4, borderLeftColor: colors.accent },
  calloutLabel: { ...typography.overline, color: colors.dueSoon },
  calloutText: { ...typography.body, color: colors.ink },
});
