import type { FontVariant, TextStyle } from "react-native";

// "Digital khata": the paper, ink and margin-rule of an Indian account book.
export const colors = {
  background: "#F4EFE4",
  surface: "#FFFCF5",
  surfaceMuted: "#ECE5D6",
  border: "#E2D9C6",
  borderStrong: "#CBBFA6",
  ink: "#1C1B17",
  inkMuted: "#5F594D",
  inkSubtle: "#8C8576",
  primary: "#0E5A43",
  primaryPressed: "#0A4434",
  primaryDeep: "#0B3B2E",
  primarySoft: "#DDEBE3",
  onPrimary: "#FFFCF5",
  onPrimaryMuted: "rgba(255,252,245,0.68)",
  onPrimaryFaint: "rgba(255,252,245,0.12)",
  accent: "#E4A23C",
  accentSoft: "#FBEFD8",
  overdue: "#C23B22",
  overdueSoft: "#FBE6E0",
  overdueBorder: "#F0BFB2",
  dueSoon: "#A86200",
  dueSoonSoft: "#FBEFD8",
  dueSoonBorder: "#EFD3A1",
  pending: "#0E5A43",
  partial: "#2F6690",
  partialSoft: "#E1EBF3",
  repaid: "#56786B",
  repaidSoft: "#E5EDE8",
  danger: "#B42318",
  dangerSoft: "#FEF3F2",
  marginRule: "rgba(194,59,34,0.35)",
  ruled: "rgba(14,90,67,0.07)",
  scrim: "rgba(28,27,23,0.5)",
  avatar: ["#DDEBE3", "#E8E1F5", "#FBE7D3", "#DDE8F7", "#F5DDE3", "#E6EBD5"],
  avatarInk: "#1C1B17",
} as const;

export const fonts = {
  display: "Fraunces_600SemiBold",
  displayBold: "Fraunces_700Bold",
  displayItalic: "Fraunces_400Regular_Italic",
  body: "Manrope_500Medium",
  bodyRegular: "Manrope_400Regular",
  bodySemi: "Manrope_600SemiBold",
  bodyBold: "Manrope_700Bold",
  bodyHeavy: "Manrope_800ExtraBold",
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;
export const radii = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

const t = (s: TextStyle) => s;

export const typography = {
  display: t({ fontFamily: fonts.displayBold, fontSize: 42, lineHeight: 48, letterSpacing: -1 }),
  hero: t({ fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 40, letterSpacing: -0.6 }),
  title: t({ fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 }),
  heading: t({ fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 22 }),
  amount: t({ fontFamily: fonts.display, fontSize: 18, lineHeight: 22 }),
  body: t({ fontFamily: fonts.body, fontSize: 15, lineHeight: 21 }),
  bodyStrong: t({ fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 21 }),
  label: t({ fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 19 }),
  caption: t({ fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17 }),
  overline: t({ fontFamily: fonts.bodyHeavy, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: "uppercase" }),
  money: { fontVariant: ["tabular-nums"] as FontVariant[] },
} as const;

export const shadows = {
  card: { shadowColor: "#3B2F14", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  raised: { shadowColor: "#3B2F14", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 8 },
} as const;

export const layout = { screenPadding: 18, minTouch: 44, maxContentWidth: 520, tabBarHeight: 64 } as const;
