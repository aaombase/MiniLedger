import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, NotebookPen } from "lucide-react-native";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts, layout, radii, spacing, typography } from "@/theme/tokens";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { FieldMessage } from "@/components/FieldMessage";
import { OtpInput } from "@/components/OtpInput";
import { useToast } from "@/components/ToastProvider";
import { useRequestOtp, useVerifyOtp } from "@/api/queries";
import { isApiError } from "@/api/ApiError";
import { useAuth } from "@/auth/AuthProvider";
import { haptics } from "@/platform/haptics";
import { phoneFormSchema } from "@/shared/schemas";
import { formatPhoneForDisplay, groupPhoneDigits, normalizeIndianMobile } from "@/shared/phone";

function useCountdown(): [number, (s: number) => void] {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= now) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [until, now]);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  return [left, (s: number) => { const n = Date.now(); setNow(n); setUntil(n + s * 1000); }];
}

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function LoginScreen() {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [resendLeft, startResend] = useCountdown();
  const [rateLeft, startRate] = useCountdown();
  const requestOtp = useRequestOtp();

  async function send(digits: string, isResend = false): Promise<boolean> {
    const e164 = normalizeIndianMobile(digits);
    if (!e164) return false;
    try {
      const r = await requestOtp.mutateAsync(e164);
      startResend(r.resendAfterSeconds);
      return true;
    } catch (e) {
      if (isApiError(e) && e.code === "OTP_RATE_LIMITED") {
        const s = Number(e.details?.retryAfterSeconds ?? 30);
        if (isResend) startResend(s); else startRate(s);
      }
      throw e;
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {step === "phone" ? (
          <PhoneStep
            initial={phone}
            loading={requestOtp.isPending}
            rateLeft={rateLeft}
            onSubmit={async (digits) => {
              setPhone(digits);
              const ok = await send(digits).catch(() => false);
              if (ok) setStep("code");
              return ok;
            }}
            errorFor={() => requestOtp.error}
          />
        ) : (
          <CodeStep
            phone={phone}
            resendLeft={resendLeft}
            onBack={() => setStep("phone")}
            onResend={() => send(phone, true)}
          />
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function PhoneStep({ initial, loading, rateLeft, onSubmit, errorFor }: {
  initial: string; loading: boolean; rateLeft: number; onSubmit: (d: string) => Promise<boolean>; errorFor: () => unknown;
}) {
  const [focused, setFocused] = useState(false);
  const { control, handleSubmit, watch, formState } = useForm<{ phone: string }>({
    resolver: zodResolver(phoneFormSchema as never) as never,
    defaultValues: { phone: groupPhoneDigits(initial) },
    mode: "onTouched",
  });
  const digits = watch("phone").replace(/\D/g, "");
  const valid = normalizeIndianMobile(digits) !== null;
  const err = errorFor();
  const otherError = isApiError(err) && err.code !== "OTP_RATE_LIMITED" ? (err.status === 0 ? "Couldn't reach MiniLedger. Try again." : "Something went wrong. Try again.") : undefined;
  const errorText =
    rateLeft > 0 ? `Too many requests. Try again in ${rateLeft} s.` : formState.errors.phone?.message ?? otherError;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      <View style={styles.brand}>
        <View style={styles.mark}><NotebookPen size={28} color={colors.onPrimary} /></View>
        <Text style={styles.appName} accessibilityRole="header">MiniLedger</Text>
        <Text style={styles.tagline}>Your pocket khata for money lent to friends.</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Phone number</Text>
        <View style={[styles.phoneBox, focused ? styles.phoneFocused : null]}>
          <View style={styles.prefix}><Text style={styles.prefixText}>+91</Text></View>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <TextInput
                value={field.value}
                onChangeText={(t) => field.onChange(groupPhoneDigits(t))}
                onBlur={() => { setFocused(false); field.onBlur(); }}
                onFocus={() => setFocused(true)}
                keyboardType="phone-pad"
                maxLength={11}
                placeholder="98765 43210"
                placeholderTextColor={colors.inkSubtle}
                autoFocus
                textContentType="telephoneNumber"
                autoComplete="tel-national"
                accessibilityLabel="Phone number"
                returnKeyType="go"
                onSubmitEditing={() => { if (valid) void handleSubmit((v) => onSubmit(v.phone))(); }}
                style={styles.phoneInput}
              />
            )}
          />
        </View>
        <FieldMessage error={errorText} helper="We'll send a 6-digit code to verify it's you." />
      </View>

      <View style={styles.flex} />
      <Button
        title="Send code"
        onPress={() => void handleSubmit((v) => onSubmit(v.phone))()}
        disabled={!valid || rateLeft > 0}
        loading={loading}
        fullWidth
      />
      <Text style={styles.footer}>Demo build · the code is printed in the server log.</Text>
    </ScrollView>
  );
}

function CodeStep({ phone, resendLeft, onBack, onResend }: { phone: string; resendLeft: number; onBack: () => void; onResend: () => Promise<boolean> }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const verify = useVerifyOtp();
  const auth = useAuth();
  const toast = useToast();
  const e164 = normalizeIndianMobile(phone) ?? "";

  async function submit(c: string) {
    if (c.length !== 6 || verify.isPending) return;
    setError(null);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      const r = await verify.mutateAsync({ phone: e164, code: c, timezone: tz });
      haptics.success();
      // Signing in flips the auth guard in app/_layout.tsx, which navigates to the ledger by itself.
      await auth.signIn(r.token, r.user);
    } catch (e) {
      haptics.warning();
      setCode("");
      if (!isApiError(e)) setError("Something went wrong. Try again.");
      else if (e.code === "OTP_INVALID") {
        const n = Number(e.details?.attemptsRemaining ?? 0);
        setError(`That code isn't right. ${n} ${n === 1 ? "attempt" : "attempts"} left.`);
      } else if (e.code === "OTP_EXPIRED") setError("This code has expired. Request a new one.");
      else if (e.code === "OTP_TOO_MANY_ATTEMPTS") setError("Too many wrong attempts. Request a new code.");
      else if (e.status === 0) setError("Couldn't reach MiniLedger. Check your connection.");
      else setError("Something went wrong. Try again.");
    }
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      <Pressable onPress={onBack} accessibilityLabel="Change number" style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}>
        <ChevronLeft size={20} color={colors.primary} />
        <Text style={styles.backText}>Change number</Text>
      </Pressable>

      <View style={styles.codeHead}>
        <Text style={styles.appName} accessibilityRole="header">Enter the code</Text>
        <Text style={styles.tagline}>
          Sent to <Text style={styles.strong}>{formatPhoneForDisplay(e164)}</Text>
        </Text>
      </View>

      <View style={styles.otpBlock}>
        <OtpInput value={code} onChange={(v) => { setCode(v); if (error) setError(null); }} onComplete={(v) => void submit(v)} error={!!error} autoFocus />
        {error ? <View style={styles.center}><FieldMessage error={error} /></View> : null}
      </View>

      <View style={styles.resendRow}>
        {resendLeft > 0 ? (
          <Text style={[styles.resendText, typography.money]}>Didn't get it? Resend in {fmtClock(resendLeft)}</Text>
        ) : (
          <Pressable
            accessibilityLabel="Resend code"
            onPress={() => {
              setError(null);
              setCode("");
              onResend().then(() => toast.show({ message: "New code sent", tone: "success" })).catch(() => toast.show({ message: "Couldn't send a new code", tone: "error" }));
            }}
            style={({ pressed }) => [styles.resendBtn, pressed ? styles.pressed : null]}
          >
            <Text style={styles.resendLink}>Resend code</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.flex} />
      <Button title="Verify" onPress={() => void submit(code)} disabled={code.length !== 6} loading={verify.isPending} fullWidth />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: spacing.lg, paddingTop: spacing.xxxl + spacing.sm, gap: spacing.xxl },
  brand: { gap: spacing.sm },
  mark: { width: 60, height: 60, borderRadius: 18, backgroundColor: colors.primaryDeep, transform: [{ rotate: "-6deg" }], alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  appName: { fontFamily: fonts.displayBold, fontSize: 40, lineHeight: 46, letterSpacing: -1, color: colors.primaryDeep },
  tagline: { fontFamily: fonts.displayItalic, fontSize: 19, lineHeight: 26, color: colors.inkMuted },
  strong: { ...typography.bodyStrong, color: colors.ink },
  field: { gap: spacing.sm, marginTop: spacing.lg },
  label: { ...typography.label, color: colors.ink },
  phoneBox: { height: 56, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  phoneFocused: { borderWidth: 2, borderColor: colors.primary },
  prefix: { paddingHorizontal: spacing.lg, height: 32, justifyContent: "center", borderRightWidth: 1, borderRightColor: colors.border },
  prefixText: { ...typography.bodyStrong, ...typography.money, color: colors.inkMuted },
  phoneInput: { flex: 1, height: 52, paddingHorizontal: spacing.md, ...typography.body, fontSize: 18, letterSpacing: 0.5, ...typography.money, color: colors.ink },
  footer: { ...typography.caption, color: colors.inkSubtle, textAlign: "center", marginTop: -spacing.sm },
  back: { flexDirection: "row", alignItems: "center", gap: spacing.xxs, alignSelf: "flex-start", minHeight: layout.minTouch, paddingRight: spacing.sm, marginLeft: -spacing.xs, marginTop: -spacing.xxl },
  backText: { ...typography.label, color: colors.primary },
  pressed: { opacity: 0.6 },
  codeHead: { gap: spacing.sm },
  otpBlock: { gap: spacing.md, marginTop: spacing.sm },
  center: { alignItems: "center" },
  resendRow: { alignItems: "center", minHeight: layout.minTouch, justifyContent: "center" },
  resendText: { ...typography.label, color: colors.inkSubtle },
  resendBtn: { minHeight: layout.minTouch, justifyContent: "center", paddingHorizontal: spacing.md },
  resendLink: { ...typography.label, color: colors.primary, fontFamily: fonts.bodyBold },
});
