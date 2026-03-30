import React, { useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "@/components/themed-text";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";

export default function ServerConfigScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { configureServer } = useAuth();
  const [url, setUrl] = useState("https://");
  const [loading, setLoading] = useState(false);

  const handleConfigure = async () => {
    if (!url || url === "https://") {
      Alert.alert("Error", "Please enter your OpenLingo server URL");
      return;
    }

    setLoading(true);
    try {
      // Test the connection
      const testUrl = url.replace(/\/$/, "");
      const res = await fetch(`${testUrl}/api/auth/get-session`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      // If we get any response (even 401), the server is reachable
      if (res.status >= 500) {
        throw new Error("Server error");
      }
      await configureServer(url);
      router.replace("/(auth)/sign-in");
    } catch (e) {
      Alert.alert(
        "Connection Failed",
        "Could not connect to the server. Please check the URL and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <View style={styles.header}>
          <ThemedText style={styles.logo}>🌍</ThemedText>
          <ThemedText type="title" style={styles.title}>
            OpenLingo
          </ThemedText>
          <ThemedText
            themeColor="textSecondary"
            style={styles.subtitle}
          >
            Connect to your OpenLingo server
          </ThemedText>
        </View>

        <View style={styles.form}>
          <ThemedText style={styles.label}>Server URL</ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundElement,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={url}
            onChangeText={setUrl}
            placeholder="https://your-server.com"
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <TouchableOpacity
            style={[
              styles.button,
              { opacity: loading ? 0.7 : 1 },
            ]}
            onPress={handleConfigure}
            disabled={loading}
          >
            <ThemedText style={styles.buttonText}>
              {loading ? "Connecting..." : "Connect"}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.six,
  },
  logo: {
    fontSize: 64,
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 36,
    fontWeight: "700",
    marginBottom: Spacing.two,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
  },
  form: {
    gap: Spacing.three,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.half,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.select({ ios: 14, android: 12 }),
    fontSize: 16,
  },
  button: {
    backgroundColor: Brand.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: Spacing.two,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
