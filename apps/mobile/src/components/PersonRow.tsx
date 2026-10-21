import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radii, spacing, typography } from "@/theme/tokens";
import { formatINR } from "@/shared/money";
import { plural } from "@/shared/dates";
import type { Person } from "@/lib/people";
import { Avatar } from "./Avatar";
import { ProgressBar } from "./ProgressBar";
import { Stamp } from "./Stamp";

export function PersonRow({ person, onPress }: { person: Person; onPress: () => void }) {
  const settled = person.owedMinor === 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
      accessibilityLabel={settled ? `${person.name}, all settled` : `${person.name}, owes ${formatINR(person.owedMinor)}`}
    >
      <View style={styles.row}>
        <Avatar name={person.name} status={person.status} size={44} />
        <View style={styles.middle}>
          <Text style={styles.name} numberOfLines={1}>{person.name}</Text>
          <Text style={styles.meta}>
            {plural(person.loans.length, "loan")}{person.openCount ? ` · ${person.openCount} open` : ""}
          </Text>
        </View>
        <View style={styles.right}>
          {settled ? (
            <Stamp status="repaid" label="Settled" />
          ) : (
            <>
              <Text style={[styles.amount, typography.money, person.overdueMinor > 0 ? { color: colors.overdue } : null]}>
                {formatINR(person.owedMinor)}
              </Text>
              <Text style={styles.meta}>owes you</Text>
            </>
          )}
        </View>
      </View>
      <View style={styles.bar}>
        <ProgressBar value={person.lentMinor ? person.paidMinor / person.lentMinor : 0} height={4} />
        <Text style={styles.barText}>{formatINR(person.paidMinor)} of {formatINR(person.lentMinor)} returned</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginVertical: 5, gap: spacing.md },
  pressed: { backgroundColor: colors.surfaceMuted },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  middle: { flex: 1, gap: 2 },
  name: { ...typography.bodyStrong, color: colors.ink },
  meta: { ...typography.caption, color: colors.inkMuted },
  right: { alignItems: "flex-end", gap: 2 },
  amount: { fontFamily: fonts.display, fontSize: 19, lineHeight: 23, color: colors.ink },
  bar: { gap: 5 },
  barText: { ...typography.caption, color: colors.inkSubtle },
});
