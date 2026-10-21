import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radii, shadows, spacing, typography } from "@/theme/tokens";
import { formatINR } from "@/shared/money";
import { plural } from "@/shared/dates";
import type { Summary } from "@/shared/types";
import { ProgressBar } from "./ProgressBar";
import { Skeleton } from "./Skeleton";

/** Counts up to a value; the displayed figure is always whole paise. */
function useCountUp(target: number, duration = 900): number {
  const anim = useRef(new Animated.Value(0)).current;
  const [value, setValue] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setValue(Math.round(v)));
    Animated.timing(anim, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [target, duration, anim]);
  return value;
}

/** Faint horizontal rules and a margin line, so the card reads like a page from a ledger. */
function Ruled() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 14 }, (_, i) => (
        <View key={i} style={[styles.rule, { top: 26 + i * 22 }]} />
      ))}
      <View style={styles.marginLine} />
    </View>
  );
}

export function SummaryCard({ summary, loading }: { summary?: Summary; loading?: boolean }) {
  const owed = useCountUp(summary?.outstandingMinor ?? 0);
  if (loading || !summary) {
    return (
      <View style={styles.card}>
        <Ruled />
        <Skeleton width={110} height={12} color={colors.onPrimaryFaint} />
        <Skeleton width={200} height={44} color={colors.onPrimaryFaint} radius={8} style={{ marginTop: 12 }} />
        <Skeleton width="100%" height={8} color={colors.onPrimaryFaint} style={{ marginTop: 24 }} />
      </View>
    );
  }
  const { totalLentMinor: lent, totalRepaidMinor: repaid, overdueMinor, counts } = summary;
  const rate = lent > 0 ? repaid / lent : 0;
  const caption =
    counts.outstanding === 0
      ? counts.total ? "Every loan is settled. Nicely done." : "Nothing lent yet."
      : `across ${plural(counts.outstanding, "open loan")}${counts.partial ? ` · ${counts.partial} part-paid` : ""}`;
  return (
    <View style={styles.card} accessibilityLabel={`You are owed ${formatINR(summary.outstandingMinor)}`}>
      <Ruled />
      <Text style={styles.overline}>You're owed</Text>
      <Text style={[styles.hero, typography.money]} adjustsFontSizeToFit numberOfLines={1}>{formatINR(owed)}</Text>
      <Text style={styles.caption}>{caption}</Text>

      <View style={styles.progress}>
        <ProgressBar value={rate} color={colors.accent} track={colors.onPrimaryFaint} height={8} />
        <View style={styles.progressLabels}>
          <Text style={styles.caption}>{Math.round(rate * 100)}% collected</Text>
          <Text style={[styles.caption, typography.money]}>{formatINR(repaid)} / {formatINR(lent)}</Text>
        </View>
      </View>

      <View style={styles.tiles}>
        <Tile label="Lent" value={formatINR(lent)} />
        <Tile label="Collected" value={formatINR(repaid)} />
        <Tile label="Overdue" value={formatINR(overdueMinor)} alert={overdueMinor > 0} />
      </View>
    </View>
  );
}

function Tile({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <View style={[styles.tile, alert ? styles.tileAlert : null]}>
      <Text style={[styles.tileLabel, alert ? { color: "#FFD9CF" } : null]}>{label}</Text>
      <Text style={[styles.tileValue, typography.money]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.primaryDeep, borderRadius: radii.xl, padding: spacing.xl, paddingLeft: spacing.xl + 10, overflow: "hidden", ...shadows.raised },
  rule: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,252,245,0.07)" },
  marginLine: { position: "absolute", top: 0, bottom: 0, left: 16, width: 1.5, backgroundColor: "rgba(228,162,60,0.45)" },
  overline: { ...typography.overline, color: colors.onPrimaryMuted },
  hero: { fontFamily: fonts.displayBold, fontSize: 46, lineHeight: 54, letterSpacing: -1, color: colors.onPrimary, marginTop: spacing.xs },
  caption: { ...typography.caption, color: colors.onPrimaryMuted },
  progress: { marginTop: spacing.xl, gap: spacing.sm },
  progressLabels: { flexDirection: "row", justifyContent: "space-between" },
  tiles: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
  tile: { flex: 1, borderRadius: radii.md, padding: spacing.md, backgroundColor: colors.onPrimaryFaint, gap: 4 },
  tileAlert: { backgroundColor: "rgba(194,59,34,0.55)" },
  tileLabel: { ...typography.overline, fontSize: 10, color: colors.onPrimaryMuted },
  tileValue: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, color: colors.onPrimary },
});
