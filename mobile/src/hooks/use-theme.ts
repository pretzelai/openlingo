import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function useTheme() {
  const scheme = useColorScheme();
  const theme = scheme === "unspecified" ? "light" : scheme;
  return Colors[theme];
}

export function useThemeScheme() {
  const scheme = useColorScheme();
  return scheme === "unspecified" ? "light" : scheme;
}
