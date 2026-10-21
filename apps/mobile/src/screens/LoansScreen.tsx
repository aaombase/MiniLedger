import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, SearchX } from "lucide-react-native";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, fonts, layout, spacing, typography } from "@/theme/tokens";
import { useLoans } from "@/api/queries";
import { LoanCard, LoanCardSkeleton } from "@/components/LoanCard";
import { SearchBar } from "@/components/SearchBar";
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { formatINR } from "@/shared/money";
import type { Loan } from "@/shared/types";

type Filter = "all" | "overdue" | "due_soon" | "partial" | "pending" | "repaid";
const FILTERS: { key: Filter; label: string; match: (l: Loan) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "overdue", label: "Overdue", match: (l) => l.status === "overdue" },
  { key: "due_soon", label: "Due soon", match: (l) => l.status === "due_soon" },
  { key: "partial", label: "Part-paid", match: (l) => l.status !== "repaid" && l.paidMinor > 0 },
  { key: "pending", label: "Upcoming", match: (l) => l.status === "pending" },
  { key: "repaid", label: "Settled", match: (l) => l.status === "repaid" },
];

type Sort = "urgency" | "amount" | "due" | "name";
const SORTS: { key: Sort; label: string }[] = [
  { key: "urgency", label: "Most urgent" },
  { key: "amount", label: "Largest" },
  { key: "due", label: "Due date" },
  { key: "name", label: "Name" },
];

function sortLoans(list: Loan[], sort: Sort): Loan[] {
  if (sort === "urgency") return list; // the server already returns most-urgent first
  return [...list].sort((a, b) => {
    if (sort === "amount") return b.remainingMinor - a.remainingMinor;
    if (sort === "due") return a.dueDate.localeCompare(b.dueDate);
    return a.friendName.localeCompare(b.friendName);
  });
}

export function LoansScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const loans = useLoans("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("urgency");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (params.filter && FILTERS.some((f) => f.key === params.filter)) setFilter(params.filter as Filter);
  }, [params.filter]);

  const all = loans.data?.loans ?? [];
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, all.filter(f.match).length])) as Record<Filter, number>, [all]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = FILTERS.find((f) => f.key === filter)!.match;
    const list = all.filter((l) => match(l) && (!q || l.friendName.toLowerCase().includes(q) || (l.note ?? "").toLowerCase().includes(q)));
    return sortLoans(list, sort);
  }, [all, filter, query, sort]);
  const openTotal = visible.filter((l) => l.status !== "repaid").reduce((s, l) => s + l.remainingMinor, 0);

  const nextSort = () => setSort((s) => SORTS[(SORTS.findIndex((x) => x.key === s) + 1) % SORTS.length]!.key);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">Khata</Text>
          <Pressable onPress={nextSort} style={({ pressed }) => [styles.sort, pressed ? { opacity: 0.6 } : null]} accessibilityLabel={`Sorted by ${SORTS.find((s) => s.key === sort)!.label}. Change sort`}>
            <ArrowDownUp size={14} color={colors.primary} />
            <Text style={styles.sortText}>{SORTS.find((s) => s.key === sort)!.label}</Text>
          </Pressable>
        </View>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search name or note" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll} keyboardShouldPersistTaps="handled">
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={`${f.label} ${counts[f.key] ?? 0}`}
              selected={filter === f.key}
              onPress={() => setFilter(f.key)}
              dot={f.key === "overdue" && counts.overdue > 0 ? colors.overdue : undefined}
            />
          ))}
        </ScrollView>
      </View>

      {loans.isError && !loans.data ? (
        <ErrorState onRetry={() => void loans.refetch()} />
      ) : (
        <FlatList
          data={loans.isLoading ? [] : visible}
          keyExtractor={(l) => l.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loans.isRefetching} onRefresh={() => void loans.refetch()} tintColor={colors.primary} colors={[colors.primary]} />}
          ListHeaderComponent={
            visible.length > 0 && openTotal > 0 ? (
              <Text style={styles.total}>{visible.length} shown · <Text style={styles.totalStrong}>{formatINR(openTotal)}</Text> still out</Text>
            ) : null
          }
          ListEmptyComponent={
            loans.isLoading ? (
              <View>{[0, 1, 2, 3].map((i) => <LoanCardSkeleton key={i} />)}</View>
            ) : (
              <EmptyState
                icon={SearchX}
                tone="muted"
                title={query ? `Nothing matches "${query}"` : all.length ? "Nothing here" : "No loans yet"}
                body={all.length ? "Try another filter or search." : "Tap + to record money you've lent."}
              />
            )
          }
          renderItem={({ item }) => <LoanCard loan={item} onPress={() => router.push(`/loans/${item.id}`)} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: layout.screenPadding, paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.md,
    backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.ink },
  sort: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.primarySoft },
  sortText: { ...typography.caption, fontFamily: fonts.bodyBold, color: colors.primary },
  chipScroll: { marginHorizontal: -layout.screenPadding },
  chips: { gap: spacing.sm, paddingHorizontal: layout.screenPadding },
  list: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.md, paddingBottom: spacing.huge, flexGrow: 1 },
  total: { ...typography.caption, color: colors.inkMuted, marginBottom: spacing.xs },
  totalStrong: { fontFamily: fonts.bodyBold, color: colors.ink },
});
