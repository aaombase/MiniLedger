import { useState } from "react";
import { X } from "lucide-react-native";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, fonts, layout, radii, spacing, typography } from "@/theme/tokens";
import { useLoan, useRecordPayment, useUploadPaymentReceipt } from "@/api/queries";
import { isApiError } from "@/api/ApiError";
import { haptics } from "@/platform/haptics";
import { DatePickerField } from "@/platform/DatePickerField";
import { ScreenHeader } from "@/components/ScreenHeader";
import { IconButton } from "@/components/IconButton";
import { AmountField } from "@/components/AmountField";
import { TextField } from "@/components/TextField";
import { Chip } from "@/components/Chip";
import { PhotoField } from "@/components/PhotoField";
import { Button } from "@/components/Button";
import { Banner } from "@/components/Banner";
import { Avatar } from "@/components/Avatar";
import { ProgressBar } from "@/components/ProgressBar";
import { useToast } from "@/components/ToastProvider";
import type { PickedImage } from "@/shared/types";
import { formatINR, hasTooManyDecimals, MIN_PAISE, parseRupeesToPaise } from "@/shared/money";
import { addDays, formatWeekdayDate } from "@/shared/dates";

type When = "today" | "yesterday" | "pick";

const toRupeeString = (paise: number) => (paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2));

export function RecordPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const loanQ = useLoan(id);
  const record = useRecordPayment();
  const uploadProof = useUploadPaymentReceipt();
  const [proof, setProof] = useState<PickedImage | null>(null);
  const [amount, setAmount] = useState("");
  const [touched, setTouched] = useState(false);
  const [when, setWhen] = useState<When>("today");
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const loan = loanQ.data;
  const header = <ScreenHeader title="Record payment" left={<IconButton icon={X} onPress={() => router.back()} accessibilityLabel="Close" />} />;
  if (!loan) return <SafeAreaView style={styles.root}>{header}</SafeAreaView>;

  const remaining = loan.remainingMinor;
  // Our "today" comes from the server-side derived fields, never the phone clock.
  const today = loan.daysUntilDue !== null ? addDays(loan.dueDate, -loan.daysUntilDue) : null;
  const paise = parseRupeesToPaise(amount);
  const amountError = !amount
    ? "Enter the amount you received"
    : hasTooManyDecimals(amount)
      ? "Use at most 2 decimal places"
      : paise === null || paise < Math.min(MIN_PAISE, remaining)
        ? "Enter at least ₹1"
        : paise > remaining
          ? `${loan.friendName.split(" ")[0]} only owes ${formatINR(remaining)}`
          : undefined;
  const paidOn = when === "today" ? today : when === "yesterday" && today ? addDays(today, -1) : picked;
  const settles = paise !== null && paise === remaining;
  const after = paise !== null && !amountError ? loan.paidMinor + paise : loan.paidMinor;

  const quick = (fraction: number) => {
    const v = fraction === 1 ? remaining : Math.round((remaining * fraction) / 100) * 100;
    setAmount(toRupeeString(Math.max(v, MIN_PAISE)));
    setTouched(true);
    haptics.selection();
  };

  async function save() {
    setTouched(true);
    if (amountError || paise === null || !paidOn) return;
    setFormError(null);
    try {
      const updated = await record.mutateAsync({ id: loan!.id, input: { amountMinor: paise, paidOn, note: note.trim() || null } });
      haptics.success();
      // The payment is already saved; a failed photo must not look like a failed payment.
      let proofFailed = false;
      const newest = updated.payments[0];
      if (proof && newest) {
        try { await uploadProof.mutateAsync({ loanId: loan!.id, paymentId: newest.id, image: proof }); } catch { proofFailed = true; }
      }
      router.back();
      const done = updated.status === "repaid" ? `${loan!.friendName.split(" ")[0]} is all settled 🎉` : `${formatINR(paise)} recorded · ${formatINR(updated.remainingMinor)} left`;
      toast.show({ message: proofFailed ? `${done}. The photo couldn't be saved: add it from the loan.` : done, tone: proofFailed ? "info" : "success" });
    } catch (e) {
      if (isApiError(e) && e.code === "AMOUNT_EXCEEDS_BALANCE") setFormError(`That's more than what's owed (${formatINR(Number(e.details?.remainingMinor ?? remaining))}).`);
      else if (isApiError(e) && e.code === "LOAN_ALREADY_REPAID") setFormError("This loan is already settled.");
      else if (isApiError(e) && e.status === 0) setFormError("Couldn't reach MiniLedger. The payment wasn't saved.");
      else setFormError("Something went wrong. The payment wasn't saved.");
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      {header}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
          <View style={styles.who}>
            <Avatar name={loan.friendName} size={40} status={loan.status} />
            <View style={styles.flex}>
              <Text style={styles.whoName}>{loan.friendName}</Text>
              <Text style={styles.caption}>owes {formatINR(remaining)} of {formatINR(loan.amountMinor)}</Text>
            </View>
          </View>

          <AmountField
            label="Amount received"
            value={amount}
            onChangeText={(t) => { setAmount(t); }}
            onBlur={() => setTouched(true)}
            error={touched ? amountError : undefined}
            helper={`Up to ${formatINR(remaining)}`}
            autoFocus
          />
          <View style={styles.chips}>
            <Chip label="¼" selected={false} onPress={() => quick(0.25)} />
            <Chip label="½" selected={false} onPress={() => quick(0.5)} />
            <Chip label={`All ${formatINR(remaining)}`} selected={settles} onPress={() => quick(1)} />
          </View>

          <View style={styles.preview}>
            <ProgressBar value={after / loan.amountMinor} height={8} color={settles ? colors.repaid : colors.primary} />
            <Text style={styles.caption}>
              {settles ? "This settles the loan in full." : `After this: ${formatINR(loan.amountMinor - after)} left`}
            </Text>
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Received on</Text>
            <View style={styles.chips}>
              <Chip label="Today" selected={when === "today"} onPress={() => setWhen("today")} />
              <Chip label="Yesterday" selected={when === "yesterday"} onPress={() => setWhen("yesterday")} />
              <Chip label="Pick a date" selected={when === "pick"} onPress={() => setWhen("pick")} />
            </View>
            {when === "pick" && today ? (
              <DatePickerField value={picked} onChange={setPicked} minimumDate={addDays(today, -365 * 5)} maximumDate={today} />
            ) : null}
            {paidOn ? <Text style={styles.caption}>{formatWeekdayDate(paidOn)}</Text> : null}
          </View>

          <TextField
            label="Note (optional)"
            value={note}
            onChangeText={(t) => setNote(t.slice(0, 200))}
            placeholder="e.g. GPay, cash"
            maxLength={200}
          />

          <PhotoField label="Proof of payment (optional)" hint="Add a UPI screenshot or photo" value={proof} onChange={setProof} />
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={styles.bottom}>
        {formError ? <Banner tone="danger" message={formError} /> : null}
        <Button
          title={settles ? "Record & settle" : paise && !amountError ? `Record ${formatINR(paise)}` : "Record payment"}
          onPress={() => void save()}
          disabled={!!amountError || !paidOn}
          loading={record.isPending || uploadProof.isPending}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  form: { gap: spacing.xl, paddingHorizontal: layout.screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xxl, width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  who: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
  whoName: { ...typography.bodyStrong, color: colors.ink },
  caption: { ...typography.caption, color: colors.inkMuted },
  chips: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginTop: -spacing.sm },
  preview: { gap: spacing.sm },
  group: { gap: spacing.md },
  label: { ...typography.label, fontFamily: fonts.bodySemi, color: colors.ink },
  bottom: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg, gap: spacing.md },
});
