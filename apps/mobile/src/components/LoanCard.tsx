import { Paperclip } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radii, spacing, typography } from "@/theme/tokens";
import { formatINR, spokenINR } from "@/shared/money";
import { formatRelativeDue, plural } from "@/shared/dates";
import type { Loan } from "@/shared/types";
import { Avatar } from "./Avatar";
import { ProgressBar } from "./ProgressBar";
import { Skeleton, usePulse } from "./Skeleton";
import { Stamp } from "./Stamp";
import { statusVisuals } from "./statusVisuals";

function a11yLabel(l: Loan): string {
  const status = l.status === "overdue" ? `overdue by ${plural(-(l.daysUntilDue ?? 0), "day")}` : formatRelativeDue(l).toLowerCase();
  const part = l.paidMinor > 0 && l.status !== "repaid" ? `, ${spokenINR(l.remainingMinor)} left` : "";
  return `${l.friendName}, ${spokenINR(l.amountMinor)}${part}, ${status}`;
}

/** One line of the khata: who, what's left, and how urgent it is. */
export function LoanCard({ loan, onPress, showName = true }: { loan: Loan; onPress: () => void; showName?: boolean }) {
  const v = statusVisuals[loan.status];
  const repaid = loan.status === "repaid";
  const partial = !repaid && loan.paidMinor > 0;
  const urgent = loan.status === "overdue";
  const title = showName ? loan.friendName : loan.note ?? "Loan";
  const sub = showName ? loan.note : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={a11yLabel(loan)}
      style={({ pressed }) => [styles.card, urgent ? styles.urgent : null, pressed ? styles.pressed : null]}
    >
      <View style={[styles.margin, { backgroundColor: urgent ? colors.overdue : colors.marginRule }]} />
      <View style={styles.row}>
        {showName ? <Avatar name={loan.friendName} status={loan.status} size={40} /> : null}
        <View style={styles.middle}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, repaid ? styles.faded : null]} numberOfLines={1}>{title}</Text>
            {loan.hasReceipt ? <Paperclip size={13} color={colors.inkSubtle} /> : null}
          </View>
          <Text style={[styles.meta, { color: loan.status === "pending" || repaid ? colors.inkMuted : v.fg }]} numberOfLines={1}>
            {formatRelativeDue(loan)}{sub ? ` · ${sub}` : ""}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={[styles.amount, typography.money, urgent ? { color: colors.overdue } : null, repaid ? styles.faded : null]}>
            {formatINR(repaid ? loan.amountMinor : loan.remainingMinor)}
          </Text>
          {partial ? <Text style={styles.of}>of {formatINR(loan.amountMinor)}</Text> : <Stamp status={loan.status} />}
        </View>
      </View>
      {partial ? (
        <View style={styles.partial}>
          <ProgressBar value={loan.paidMinor / loan.amountMinor} color={colors.partial} height={4} />
          <Text style={styles.partialText}>{formatINR(loan.paidMinor)} received</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function LoanCardSkeleton() {
  const o = usePulse();
  return (
    <View style={[styles.card, { opacity: o }]}>
      <View style={styles.row}>
        <Skeleton width={46} height={46} radius={23} />
        <View style={[styles.middle, { gap: spacing.sm }]}>
          <Skeleton width={120} height={14} />
          <Skeleton width={84} height={11} />
        </View>
        <Skeleton width={64} height={18} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radii.lg, paddingVertical: 12, paddingLeft: spacing.lg + 6, paddingRight: spacing.lg,
    borderWidth: 1, borderColor: colors.border, marginVertical: 5, overflow: "hidden",
  },
  urgent: { backgroundColor: "#FFF7F3", borderColor: colors.overdueBorder },
  pressed: { backgroundColor: colors.surfaceMuted },
  margin: { position: "absolute", left: 10, top: 0, bottom: 0, width: 1.5 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  middle: { flex: 1, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { ...typography.bodyStrong, color: colors.ink, flexShrink: 1 },
  meta: { ...typography.caption },
  right: { alignItems: "flex-end", gap: 5 },
  amount: { fontFamily: fonts.display, fontSize: 19, lineHeight: 23, color: colors.ink },
  of: { ...typography.caption, color: colors.inkSubtle },
  faded: { color: colors.inkSubtle },
  partial: { marginTop: spacing.md, gap: 5 },
  partialText: { ...typography.caption, color: colors.partial },
});
