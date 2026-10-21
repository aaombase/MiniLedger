import { useMemo } from "react";
import { ChevronLeft, History } from "lucide-react-native";
import { RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fonts, layout, spacing, typography } from "@/theme/tokens";
import { useActivity } from "@/api/queries";
import { ScreenHeader } from "@/components/ScreenHeader";
import { IconButton } from "@/components/IconButton";
import { ActivityRow } from "@/components/ActivityRow";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { formatINR } from "@/shared/money";
import type { ActivityItem } from "@/shared/types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function ActivityScreen() {
  const router = useRouter();
  const activity = useActivity(500);

  const sections = useMemo(() => {
    const byMonth = new Map<string, ActivityItem[]>();
    for (const item of activity.data?.items ?? []) {
      const key = item.date.slice(0, 7);
      byMonth.set(key, [...(byMonth.get(key) ?? []), item]);
    }
    return [...byMonth.entries()].map(([key, data]) => ({
      key,
      title: `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`,
      inMinor: data.filter((d) => d.type === "payment").reduce((s, d) => s + d.amountMinor, 0),
      outMinor: data.filter((d) => d.type === "loan_created").reduce((s, d) => s + d.amountMinor, 0),
      data,
    }));
  }, [activity.data]);

  return (
    <SafeAreaView style={styles.root}>
      <ScreenHeader title="Activity" left={<IconButton icon={ChevronLeft} onPress={() => router.back()} accessibilityLabel="Back" />} />
      {activity.isError && !activity.data ? (
        <ErrorState onRetry={() => void activity.refetch()} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled
          refreshControl={<RefreshControl refreshing={activity.isRefetching} onRefresh={() => void activity.refetch()} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={activity.isLoading ? null : <EmptyState icon={History} tone="muted" title="No activity yet" body="Loans and payments will show up here." />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.month}>{section.title}</Text>
              <Text style={[styles.flow, typography.money]}>
                <Text style={{ color: colors.primary }}>+{formatINR(section.inMinor)}</Text>  ·  −{formatINR(section.outMinor)}
              </Text>
            </View>
          )}
          renderItem={({ item }) => <ActivityRow item={item} onPress={() => router.push(`/loans/${item.loanId}`)} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.huge, flexGrow: 1 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", backgroundColor: colors.background, paddingTop: spacing.lg, paddingBottom: spacing.xs },
  month: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  flow: { ...typography.caption, color: colors.inkMuted },
});
