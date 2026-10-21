import { useEffect, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@/theme/tokens";

/** Slow opacity pulse driven by React state (no CSS keyframes). */
export function usePulse(): number {
  const [on, setOn] = useState(true);
  useEffect(() => { const id = setInterval(() => setOn((v) => !v), 900); return () => clearInterval(id); }, []);
  return on ? 1 : 0.55;
}

export interface SkeletonProps { width: number | "100%"; height: number; radius?: number; color?: string; style?: StyleProp<ViewStyle> }

export function Skeleton({ width, height, radius = 6, color = colors.surfaceMuted, style }: SkeletonProps) {
  return <View style={[{ width, height, borderRadius: radius, backgroundColor: color }, style]} />;
}
