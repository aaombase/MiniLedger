import { useMemo, useState } from "react";
import { Users } from "lucide-react-native";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fonts, layout, spacing, typography } from "@/theme/tokens";
import { useLoans } from "@/api/queries";
import { PersonRow } from "@/components/PersonRow";
import { SearchBar } from "@/components/SearchBar";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoanCardSkeleton } from "@/components/LoanCard";
import { groupByPerson } from "@/lib/people";
import { plural } from "@/shared/dates";

export function PeopleScreen() {
  const router = useRouter();
  const loans = useLoans("all");
  const [query, setQuery] = useState("");
  const people = useMemo(() => groupByPerson(loans.data?.loans ?? []), [loans.data]);
  const visible = people.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  const owing = people.filter((p) => p.owedMinor > 0).length;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">People</Text>
        <Text style={styles.sub}>{people.length ? `${plural(people.length, "friend")} · ${owing} still owe you` : " "}</Text>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Find a friend" />
      </View>
      {loans.isError && !loans.data ? (
        <ErrorState onRetry={() => void loans.refetch()} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(p) => p.key}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loans.isRefetching} onRefresh={() => void loans.refetch()} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={
            loans.isLoading ? (
              <View>{[0, 1, 2].map((i) => <LoanCardSkeleton key={i} />)}</View>
            ) : (
              <EmptyState icon={Users} tone="muted" title={query ? "No one by that name" : "No one here yet"} body={query ? "Check the spelling, or add a loan for them." : "Friends appear here once you lend them money."} />
            )
          }
          renderItem={({ item }) => <PersonRow person={item} onPress={() => router.push({ pathname: "/people/[name]", params: { name: item.key } })} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.ink },
  sub: { ...typography.caption, color: colors.inkMuted, marginTop: -4, marginBottom: 4 },
  list: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.huge, flexGrow: 1 },
});
