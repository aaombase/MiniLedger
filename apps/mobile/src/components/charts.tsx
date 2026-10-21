import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Rect } from "react-native-svg";
import { colors, fonts, spacing, typography } from "@/theme/tokens";
import { formatINR } from "@/shared/money";
import type { MonthBar } from "@/lib/insights";

/** A ring showing a 0..1 share, with the figure in the middle. */
export function Donut({ value, size = 132, stroke = 14, color = colors.primary, label }: { value: number; size?: number; stroke?: number; color?: string; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`${label} ${Math.round(v * 100)} percent`}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceMuted} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={`${c * v} ${c}`} strokeLinecap="round"
          />
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={styles.donutValue}>{Math.round(v * 100)}%</Text>
        <Text style={styles.donutLabel}>{label}</Text>
      </View>
    </View>
  );
}

/** Lent vs collected per month, side by side. */
export function MonthBars({ months, width }: { months: MonthBar[]; width: number }) {
  const height = 150;
  const max = Math.max(1, ...months.flatMap((m) => [m.lentMinor, m.collectedMinor]));
  const slot = width / months.length;
  const barW = Math.min(14, slot / 3.2);
  return (
    <View>
      <Svg width={width} height={height}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <Line key={f} x1={0} x2={width} y1={height - f * (height - 8)} y2={height - f * (height - 8)} stroke={colors.border} strokeWidth={1} strokeDasharray="3 4" />
        ))}
        {months.map((m, i) => {
          const x = i * slot + slot / 2;
          const hl = (m.lentMinor / max) * (height - 8);
          const hc = (m.collectedMinor / max) * (height - 8);
          return (
            <G key={m.key}>
              <Rect x={x - barW - 2} y={height - hl} width={barW} height={Math.max(hl, m.lentMinor ? 2 : 0)} rx={4} fill={colors.inkMuted} />
              <Rect x={x + 2} y={height - hc} width={barW} height={Math.max(hc, m.collectedMinor ? 2 : 0)} rx={4} fill={colors.accent} />
            </G>
          );
        })}
      </Svg>
      <View style={styles.axis}>
        {months.map((m) => (
          <Text key={m.key} style={[styles.axisLabel, { width: slot }]}>{m.label}</Text>
        ))}
      </View>
      <View style={styles.legend}>
        <Legend color={colors.inkMuted} label={`Lent ${formatINR(months.reduce((s, m) => s + m.lentMinor, 0))}`} />
        <Legend color={colors.accent} label={`Collected ${formatINR(months.reduce((s, m) => s + m.collectedMinor, 0))}`} />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  donutValue: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 34, color: colors.ink },
  donutLabel: { ...typography.caption, color: colors.inkMuted },
  axis: { flexDirection: "row", marginTop: spacing.xs },
  axisLabel: { ...typography.caption, color: colors.inkSubtle, textAlign: "center" },
  legend: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { ...typography.caption, color: colors.inkMuted },
});
