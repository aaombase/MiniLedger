import * as ExpoHaptics from "expo-haptics";

export interface Haptics { success(): void; warning(): void; selection(): void }

// Haptic feedback is a nicety: never let a device without a haptic engine turn into an unhandled rejection.
const quiet = (p: Promise<unknown>) => void p.catch(() => {});

export const haptics: Haptics = {
  success: () => quiet(ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success)),
  warning: () => quiet(ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning)),
  selection: () => quiet(ExpoHaptics.selectionAsync()),
};
