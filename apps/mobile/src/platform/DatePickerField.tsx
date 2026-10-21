// Native adapter: @react-native-community/datetimepicker (iOS inline calendar, Android system dialog).
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { CalendarDays } from "lucide-react-native";
import { colors, radii, typography } from "@/theme/tokens";
import { formatWeekdayDate } from "@/shared/dates";

export interface DatePickerFieldProps {
  value: string | null;
  onChange(date: string): void;
  minimumDate: string;
  maximumDate: string;
}

// The picker works in the device's local calendar and hands back a Date at local midnight, so these two helpers use
// *local* getters/constructor on purpose. (Everywhere else dates stay 'YYYY-MM-DD' strings; going through UTC here
// would shift the day for anyone east of UTC, e.g. India.)
function toLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}
function fromLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DatePickerField({ value, onChange, minimumDate, maximumDate }: DatePickerFieldProps) {
  // Only decides where the calendar opens; the chosen date is whatever the user picks.
  const current = value ? toLocalDate(value) : new Date();

  const handle = (event: DateTimePickerEvent, picked?: Date) => {
    if (event.type === "set" && picked) onChange(fromLocalDate(picked));
  };

  const openAndroid = () =>
    DateTimePickerAndroid.open({
      value: current,
      mode: "date",
      minimumDate: toLocalDate(minimumDate),
      maximumDate: toLocalDate(maximumDate),
      onChange: handle,
    });

  // Android has no inline calendar: open the system dialog as soon as "Pick a date" is chosen.
  useEffect(() => {
    if (Platform.OS === "android") openAndroid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (Platform.OS === "android") {
    return (
      <Pressable
        onPress={openAndroid}
        accessibilityRole="button"
        accessibilityLabel="Choose due date"
        style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
      >
        <CalendarDays size={20} color={colors.primary} />
        <Text style={styles.buttonText}>{value ? formatWeekdayDate(value) : "Choose a date"}</Text>
      </Pressable>
    );
  }

  return (
    <DateTimePicker
      value={current}
      mode="date"
      display="inline"
      accentColor={colors.primary}
      minimumDate={toLocalDate(minimumDate)}
      maximumDate={toLocalDate(maximumDate)}
      onChange={handle}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  buttonText: { ...typography.body, color: colors.ink },
});
