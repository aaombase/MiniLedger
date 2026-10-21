import { ArrowDownLeft, ArrowUpRight, BadgeCheck } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, spacing, typography } from "@/theme/tokens";
import { formatINR } from "@/shared/money";
import { formatShortDate } from "@/shared/dates";
import type { ActivityItem } from "@/shared/types";

export function ActivityRow({ item, onPress }: { item: ActivityItem; onPress: () => void }) {
  const payment = item.type === "payment";
  const Icon = payment ? (item.settled ? BadgeCheck : ArrowDownLeft) : ArrowUpRight;
  const what = payment ? (item.settled ? "settled up" : "paid you") : "borrowed";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? { opacity: 0.6 } : null]}
      accessibilityLabel={`${item.friendName} ${what} ${formatINR(item.amountMinor)}`}
    >
      <View style={[styles.icon, { backgroundColor: payment ? colors.primarySoft : colors.surfaceMuted }]}>
        <Icon size={18} color={payment ? colors.primary : colors.inkMuted} />
      </View>
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          <Text style={styles.name}>{item.friendName}</Text> {what}
        </Text>
        <Text style={styles.date}>{formatShortDate(item.date)}</Text>
      </View>
      <Text style={[styles.amount, typography.money, { color: payment ? colors.primary : colors.ink }]}>
        {payment ? "+" : "−"}{formatINR(item.amountMinor)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 10 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  middle: { flex: 1, gap: 2 },
  title: { ...typography.body, color: colors.inkMuted },
  name: { fontFamily: fonts.bodyBold, color: colors.ink },
  date: { ...typography.caption, color: colors.inkSubtle },
  amount: { fontFamily: fonts.display, fontSize: 16, lineHeight: 20 },
});
