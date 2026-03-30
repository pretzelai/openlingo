/**
 * OpenLingo Mobile Theme
 * Colors inspired by the web version's Duolingo-like design.
 */

import "@/global.css";
import { Platform } from "react-native";

export const Brand = {
  primary: "#58CC02", // Green (Duolingo-like)
  primaryDark: "#46A302",
  secondary: "#1CB0F6", // Blue
  secondaryDark: "#1899D6",
  danger: "#FF4B4B", // Red for errors
  dangerDark: "#EA2B2B",
  warning: "#FFC800", // Yellow/gold
  warningDark: "#E5B400",
  purple: "#CE82FF",
  purpleDark: "#B65CF5",
} as const;

export const Colors = {
  light: {
    text: "#1A1A2E",
    textSecondary: "#6B7280",
    textTertiary: "#9CA3AF",
    background: "#FFFFFF",
    backgroundElement: "#F3F4F6",
    backgroundSelected: "#E5E7EB",
    border: "#E5E7EB",
    borderLight: "#F3F4F6",
    card: "#FFFFFF",
    primary: Brand.primary,
    primaryText: "#FFFFFF",
    danger: Brand.danger,
    dangerText: "#FFFFFF",
    success: Brand.primary,
    successBg: "#DCFCE7",
    errorBg: "#FEE2E2",
    warning: Brand.warning,
  },
  dark: {
    text: "#F9FAFB",
    textSecondary: "#9CA3AF",
    textTertiary: "#6B7280",
    background: "#0F0F23",
    backgroundElement: "#1A1A2E",
    backgroundSelected: "#2A2A3E",
    border: "#2A2A3E",
    borderLight: "#1A1A2E",
    card: "#1A1A2E",
    primary: Brand.primary,
    primaryText: "#FFFFFF",
    danger: Brand.danger,
    dangerText: "#FFFFFF",
    success: Brand.primary,
    successBg: "#052E16",
    errorBg: "#450A0A",
    warning: Brand.warning,
  },
} as const;

export type ThemeColor = keyof (typeof Colors)["light"] &
  keyof (typeof Colors)["dark"];

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
