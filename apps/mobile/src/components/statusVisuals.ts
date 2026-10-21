import { AlertTriangle, CalendarDays, CheckCircle2, Clock, type LucideIcon } from "lucide-react-native";
import { colors } from "@/theme/tokens";
import type { LoanStatus } from "@/shared/types";

export const statusVisuals: Record<LoanStatus, { icon: LucideIcon; fg: string; bg: string; stamp: string }> = {
  overdue: { icon: AlertTriangle, fg: colors.overdue, bg: colors.overdueSoft, stamp: "Overdue" },
  due_soon: { icon: Clock, fg: colors.dueSoon, bg: colors.dueSoonSoft, stamp: "Due soon" },
  pending: { icon: CalendarDays, fg: colors.primary, bg: colors.primarySoft, stamp: "Upcoming" },
  repaid: { icon: CheckCircle2, fg: colors.repaid, bg: colors.repaidSoft, stamp: "Paid" },
};
