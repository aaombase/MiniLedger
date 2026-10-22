import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react-native";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, layout, spacing, typography } from "@/theme/tokens";
import { ScreenHeader } from "@/components/ScreenHeader";
import { IconButton } from "@/components/IconButton";
import { TextField } from "@/components/TextField";
import { AmountField } from "@/components/AmountField";
import { Chip } from "@/components/Chip";
import { PhotoField } from "@/components/PhotoField";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { FieldMessage } from "@/components/FieldMessage";
import { useToast } from "@/components/ToastProvider";
import { DatePickerField } from "@/platform/DatePickerField";
import { haptics } from "@/platform/haptics";
import { useCreateLoan, useSummary, useUploadReceipt } from "@/api/queries";
import { isApiError } from "@/api/ApiError";
import { useLocalSearchParams, useRouter } from "expo-router";
import { createLoanFormSchema, type CreateLoanFormValues } from "@/shared/schemas";
import type { PickedImage } from "@/shared/types";
import { parseRupeesToPaise, formatINR } from "@/shared/money";
import { addDays, addMonths, daysBetween, formatRelativeDays, formatWeekdayDate } from "@/shared/dates";

type Quick = "1w" | "2w" | "1m" | "pick";

export function AddLoanScreen() {
  const router = useRouter();
  const { name: prefillName } = useLocalSearchParams<{ name?: string }>();
  const toast = useToast();
  const summary = useSummary();
  const create = useCreateLoan();
  const uploadReceipt = useUploadReceipt();
  const [receipt, setReceipt] = useState<PickedImage | null>(null);
  // "today" comes from the server's asOf; until it arrives quick chips are disabled.
  const today = summary.data?.asOf ?? null;
  const schema = useMemo(() => createLoanFormSchema(today ?? "2000-01-01"), [today]);
  const [quick, setQuick] = useState<Quick | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { control, handleSubmit, setValue, setError, watch, formState } = useForm<CreateLoanFormValues>({
    resolver: zodResolver(schema as never) as never,
    defaultValues: { friendName: prefillName ?? "", amount: "", dueDate: null, note: "" },
    mode: "onTouched",
  });
  const values = watch();
  const valid = schema.safeParse(values).success;
  const errors = formState.errors;
  const showErr = (k: keyof CreateLoanFormValues) => (formState.touchedFields[k] || formState.isSubmitted ? errors[k]?.message : undefined);

  const pickQuick = (q: Quick) => {
    setQuick(q);
    if (!today || q === "pick") return;
    const d = q === "1w" ? addDays(today, 7) : q === "2w" ? addDays(today, 14) : addMonths(today, 1);
    setValue("dueDate", d, { shouldValidate: true, shouldTouch: true, shouldDirty: true });
  };

  const close = () => (formState.isDirty || receipt ? setConfirmDiscard(true) : router.back());

  const onSave = handleSubmit(async (v) => {
    if (create.isPending) return;
    setFormError(null);
    const amountMinor = parseRupeesToPaise(v.amount);
    if (amountMinor === null || !v.dueDate) return;
    try {
      const loan = await create.mutateAsync({ friendName: v.friendName.trim(), amountMinor, dueDate: v.dueDate, note: v.note.trim() || null });
      haptics.success();
      // The loan is already saved; a failed photo must not look like a failed loan.
      let receiptFailed = false;
      if (receipt) {
        try { await uploadReceipt.mutateAsync({ id: loan.id, image: receipt }); } catch { receiptFailed = true; }
      }
      router.back();
      const done = `Added ${formatINR(loan.amountMinor)} for ${loan.friendName.split(" ")[0]}`;
      toast.show({ message: receiptFailed ? `${done}. The photo couldn't be saved: add it from the loan.` : done, tone: receiptFailed ? "info" : "success" });
    } catch (e) {
      if (isApiError(e) && e.code === "VALIDATION_ERROR" && e.details) {
        const map: Record<string, keyof CreateLoanFormValues> = { friendName: "friendName", amountMinor: "amount", dueDate: "dueDate", note: "note" };
        Object.entries(e.details).forEach(([k, msg]) => { const f = map[k]; if (f) setError(f, { message: String(msg) }); });
      } else if (isApiError(e) && e.status === 0) setFormError("Couldn't reach MiniLedger. Your loan wasn't saved.");
      else setFormError("Something went wrong. Your loan wasn't saved.");
    }
  });

  const due = values.dueDate;
  const rel = due && today ? daysBetween(today, due) : null;

  return (
    <SafeAreaView style={styles.root}>
      <ScreenHeader title="Lend money" left={<IconButton icon={X} onPress={close} accessibilityLabel="Close" />} />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
          <Controller
            control={control}
            name="friendName"
            render={({ field }) => (
              <TextField
                label="Friend's name"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="e.g. Rohan"
                autoCapitalize="words"
                returnKeyType="next"
                maxLength={60}
                autoFocus={!prefillName}
                error={showErr("friendName")}
              />
            )}
          />
          <Controller
            control={control}
            name="amount"
            render={({ field }) => <AmountField value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={showErr("amount")} />}
          />

          <View style={styles.group}>
            <Text style={styles.label}>Due date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
              <Chip label="In 1 week" selected={quick === "1w"} onPress={() => pickQuick("1w")} />
              <Chip label="In 2 weeks" selected={quick === "2w"} onPress={() => pickQuick("2w")} />
              <Chip label="In 1 month" selected={quick === "1m"} onPress={() => pickQuick("1m")} />
              <Chip label="Pick a date" selected={quick === "pick"} onPress={() => pickQuick("pick")} />
            </ScrollView>
            {quick === "pick" && today ? (
              <DatePickerField
                value={due}
                minimumDate={addDays(today, -365 * 5)}
                maximumDate={addDays(today, 365 * 5)}
                onChange={(d) => setValue("dueDate", d, { shouldValidate: true, shouldTouch: true, shouldDirty: true })}
              />
            ) : null}
            {due && rel !== null ? (
              <View style={styles.dueSummary}>
                <Text style={styles.dueDate}>{formatWeekdayDate(due)}</Text>
                <Text style={styles.caption}>{formatRelativeDays(rel)}</Text>
              </View>
            ) : null}
            {rel !== null && rel < 0 ? <Banner tone="warning" message="This date is in the past, so the loan will show as overdue." /> : null}
            <FieldMessage error={showErr("dueDate")} />
          </View>

          <Controller
            control={control}
            name="note"
            render={({ field }) => (
              <TextField
                label="Note (optional)"
                rightLabel={`${field.value.length}/200`}
                value={field.value}
                onChangeText={(t) => field.onChange(t.slice(0, 200))}
                onBlur={field.onBlur}
                placeholder="What was it for?"
                multiline
                numberOfLines={3}
                maxLength={200}
                error={showErr("note")}
              />
            )}
          />

          <PhotoField label="Receipt (optional)" hint="Attach the bill or UPI screenshot of the money you sent" value={receipt} onChange={setReceipt} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.bottom}>
        {formError ? <Banner tone="danger" message={formError} /> : null}
        <Button title="Save loan" onPress={() => void onSave()} disabled={!valid || !today} loading={create.isPending || uploadReceipt.isPending} fullWidth />
      </View>

      <ConfirmSheet
        visible={confirmDiscard}
        title="Discard this loan?"
        body="What you've entered will be lost."
        onClose={() => setConfirmDiscard(false)}
        actions={[
          { title: "Discard", variant: "danger", onPress: () => { setConfirmDiscard(false); router.back(); } },
          { title: "Keep editing", variant: "secondary", onPress: () => setConfirmDiscard(false) },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  form: { gap: spacing.xl, paddingHorizontal: layout.screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xxl, width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  group: { gap: spacing.md },
  label: { ...typography.label, color: colors.ink },
  chipScroll: { marginHorizontal: -layout.screenPadding },
  chips: { gap: spacing.sm, paddingHorizontal: layout.screenPadding },
  dueSummary: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  dueDate: { ...typography.bodyStrong, color: colors.ink },
  caption: { ...typography.caption, color: colors.inkMuted },
  bottom: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg, gap: spacing.md },
});
