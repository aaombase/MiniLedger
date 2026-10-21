import { StyleSheet, Text, View } from "react-native";
import { fonts } from "@/theme/tokens";
import type { LoanStatus } from "@/shared/types";
import { statusVisuals } from "./statusVisuals";

/** A rubber-stamp status mark, slightly askew like ink on a ledger page. */
export function Stamp({ status, label, size = "sm" }: { status: LoanStatus; label?: string; size?: "sm" | "lg" }) {
  const v = statusVisuals[status];
  const lg = size === "lg";
  return (
    <View style={[styles.stamp, lg ? styles.lg : null, { borderColor: v.fg, transform: [{ rotate: lg ? "-6deg" : "-3deg" }] }]}>
      <Text style={[styles.text, lg ? styles.textLg : null, { color: v.fg }]} numberOfLines={1}>
        {(label ?? v.stamp).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: { borderWidth: 1.5, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1, alignSelf: "flex-start" },
  lg: { borderWidth: 2.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 3 },
  text: { fontFamily: fonts.bodyHeavy, fontSize: 9.5, letterSpacing: 1.1 },
  textLg: { fontSize: 15, letterSpacing: 2.5 },
});
