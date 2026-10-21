import { useEffect, useState } from "react";
import { X } from "lucide-react-native";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, layout, spacing, typography } from "@/theme/tokens";
import { useLoan, useSummary, useUpdateLoan } from "@/api/queries";
import { isApiError } from "@/api/ApiError";
import { haptics } from "@/platform/haptics";
import { DatePickerField } from "@/platform/DatePickerField";
import { ScreenHeader } from "@/components/ScreenHeader";
import { IconButton } from "@/components/IconButton";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { Banner } from "@/components/Banner";
import { FieldMessage } from "@/components/FieldMessage";
import { useToast } from "@/components/ToastProvider";
import { formatINR } from "@/shared/money";
import { addDays } from "@/shared/dates";

export function EditLoanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const loanQ = useLoan(id);
  const update = useUpdateLoan();
  const summary = useSummary();
  const loan = loanQ.data;
  const [name, setName] = useState("");
  const [due, setDue] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!loan) return;
    setName(loan.friendName);
    setDue(loan.dueDate);
    setNote(loan.note ?? "");
  }, [loan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const header = <ScreenHeader title="Edit loan" left={<IconButton icon={X} onPress={() => router.back()} accessibilityLabel="Close" />} />;
  if (!loan) return <SafeAreaView style={styles.root}>{header}</SafeAreaView>;

  const today = summary.data?.asOf ?? loan.dueDate;
  const nameError = name.trim() ? undefined : "Enter your friend's name";

  async function save() {
    if (nameError || !due) return;
    setFormError(null);
    setErrors({});
    try {
      await update.mutateAsync({ id: loan!.id, input: { friendName: name.trim(), dueDate: due, note: note.trim() || null } });
      haptics.success();
      router.back();
      toast.show({ message: "Changes saved", tone: "success" });
    } catch (e) {
      if (isApiError(e) && e.code === "VALIDATION_ERROR" && e.details) setErrors(Object.fromEntries(Object.entries(e.details).map(([k, v]) => [k, String(v)])));
      else if (isApiError(e) && e.status === 0) setFormError("Couldn't reach MiniLedger. Nothing was changed.");
      else setFormError("Something went wrong. Nothing was changed.");
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      {header}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
          <TextField label="Friend's name" value={name} onChangeText={setName} autoCapitalize="words" maxLength={60} error={nameError ?? errors.friendName} />
          <View style={styles.group}>
            <Text style={styles.label}>Due date</Text>
            <DatePickerField value={due} onChange={setDue} minimumDate={addDays(today, -365 * 5)} maximumDate={addDays(today, 365 * 5)} />
            <FieldMessage error={errors.dueDate} />
          </View>
          <TextField label="Note (optional)" rightLabel={`${note.length}/200`} value={note} onChangeText={(t) => setNote(t.slice(0, 200))} multiline numberOfLines={3} maxLength={200} error={errors.note} />
          <Text style={styles.caption}>
            The amount ({formatINR(loan.amountMinor)}) can't be edited, so the payment history always adds up. Delete the loan and add it again if the amount was wrong.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={styles.bottom}>
        {formError ? <Banner tone="danger" message={formError} /> : null}
        <Button title="Save changes" onPress={() => void save()} disabled={!!nameError || !due} loading={update.isPending} fullWidth />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  form: { gap: spacing.xl, paddingHorizontal: layout.screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xxl, width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  group: { gap: spacing.md },
  label: { ...typography.label, color: colors.ink },
  caption: { ...typography.caption, color: colors.inkMuted },
  bottom: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg, gap: spacing.md },
});
