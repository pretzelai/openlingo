import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { useColorScheme } from "react-native";
import { AuthProvider } from "@/contexts/auth-context";
import { Brand } from "@/constants/theme";

SplashScreen.preventAutoHideAsync();

const OpenLingoLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Brand.primary,
    background: "#FFFFFF",
    card: "#FFFFFF",
    text: "#1A1A2E",
    border: "#E5E7EB",
  },
};

const OpenLingoDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Brand.primary,
    background: "#0F0F23",
    card: "#1A1A2E",
    text: "#F9FAFB",
    border: "#2A2A3E",
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider
      value={colorScheme === "dark" ? OpenLingoDarkTheme : OpenLingoLightTheme}
    >
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="lesson/[unitId]/[lessonIndex]"
            options={{
              presentation: "fullScreenModal",
              animation: "slide_from_bottom",
            }}
          />
          <Stack.Screen
            name="unit/[unitId]"
            options={{ headerShown: true, title: "Unit" }}
          />
          <Stack.Screen
            name="article/[articleId]"
            options={{ headerShown: true, title: "Article" }}
          />
          <Stack.Screen
            name="review/index"
            options={{
              presentation: "fullScreenModal",
              animation: "slide_from_bottom",
            }}
          />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
