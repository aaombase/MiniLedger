import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/theme/tokens";
import type { LoanStatus } from "@/shared/types";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase();
}

const RING: Record<LoanStatus, string | null> = { overdue: colors.overdue, due_soon: colors.accent, pending: null, repaid: null };

export function Avatar({ name, size = 42, status }: { name: string; size?: number; status?: LoanStatus }) {
  const bg = colors.avatar[hash(name.trim().toLowerCase()) % colors.avatar.length];
  const ring = status ? RING[status] : null;
  const outer = size + 6;
  return (
    <View style={[styles.ring, { width: outer, height: outer, borderRadius: outer / 2, borderColor: ring ?? "transparent" }]}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
        <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 2, alignItems: "center", justifyContent: "center" },
  circle: { alignItems: "center", justifyContent: "center" },
  text: { fontFamily: fonts.display, color: colors.avatarInk },
});
