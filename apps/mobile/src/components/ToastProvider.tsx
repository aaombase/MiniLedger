import { useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, shadows, spacing, typography } from "@/theme/tokens";

import type { ToastMsg } from "./toastContext";
import { ToastContext as Ctx, type ToastCtx } from "./toastContext";

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastMsg & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const show = useCallback((t: ToastMsg) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2500);
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  const Icon = toast?.tone === "error" ? AlertCircle : toast?.tone === "success" ? CheckCircle2 : Info;
  return (
    <Ctx.Provider value={value}>
      <View style={styles.root}>
        {children}
        {toast ? (
          <View style={[styles.wrap, { bottom: insets.bottom + 92 }]} pointerEvents="none">
            <View style={styles.toast} accessibilityRole="alert">
              <Icon size={18} color={toast.tone === "error" ? "#FDA29B" : toast.tone === "success" ? "#86EFAC" : colors.onPrimary} />
              <Text style={styles.text}>{toast.message}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("ToastProvider missing");
  return c;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  wrap: { position: "absolute", left: spacing.lg, right: spacing.lg, alignItems: "center", zIndex: 200 },
  toast: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.ink, borderRadius: radii.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, maxWidth: 360, ...shadows.raised,
  },
  text: { ...typography.label, color: colors.onPrimary, flexShrink: 1 },
});
