import { Share } from "react-native";
import { formatINR } from "@/shared/money";
import { formatShortDate } from "@/shared/dates";
import type { Loan } from "@/shared/types";

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

function line(loan: Loan): string {
  const what = loan.note ? ` for ${loan.note.toLowerCase()}` : "";
  const part = loan.paidMinor > 0 ? ` (${formatINR(loan.remainingMinor)} left of ${formatINR(loan.amountMinor)})` : "";
  const amount = loan.paidMinor > 0 ? "" : ` ${formatINR(loan.amountMinor)}`;
  const when =
    loan.status === "overdue"
      ? `was due on ${formatShortDate(loan.dueDate)}`
      : loan.daysUntilDue === 0
        ? "is due today"
        : `is due on ${formatShortDate(loan.dueDate)}`;
  return `the${amount}${what}${part} ${when}`;
}

/** A friendly reminder the user sends through WhatsApp, SMS or any app, via the system share sheet. */
export function reminderMessage(loans: Loan[]): string {
  const open = loans.filter((l) => l.status !== "repaid");
  if (open.length === 0) return "";
  const name = firstName(open[0]!.friendName);
  if (open.length === 1) {
    return `Hi ${name}! Just a gentle reminder that ${line(open[0]!)}. No rush, whenever you can. Thanks! 🙏`;
  }
  const total = open.reduce((s, l) => s + l.remainingMinor, 0);
  const items = open.map((l) => `• ${line(l).replace(/^the /, "")}`).join("\n");
  return `Hi ${name}! A quick summary of what's pending between us (${formatINR(total)} in total):\n${items}\nThanks! 🙏`;
}

export async function sendReminder(loans: Loan[]): Promise<boolean> {
  const message = reminderMessage(loans);
  if (!message) return false;
  const result = await Share.share({ message });
  return result.action === Share.sharedAction;
}
