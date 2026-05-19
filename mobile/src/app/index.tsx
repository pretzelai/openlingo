import { Redirect } from "expo-router";
import React from "react";
import {
  View,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useAuth } from "@/contexts/auth-context";
import { Brand } from "@/constants/theme";

export default function IndexScreen() {
  const { isLoading, isAuthenticated, isConfigured } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  if (!isConfigured) {
    return <Redirect href="/(auth)/server-config" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Redirect href="/(tabs)/chat" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
