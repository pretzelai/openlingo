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
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "@/components/themed-text";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";
import { getApiUrl } from "@/lib/api";

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email");
      return;
    }

    setLoading(true);
    try {
      const apiUrl = await getApiUrl();
      await fetch(`${apiUrl}/api/auth/forget-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo: `${apiUrl}/reset-password` }),
      });
      setSent(true);
    } catch {
      Alert.alert("Error", "Failed to send reset email");
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
        <TouchableOpacity onPress={() => router.back()}>
          <ThemedText style={{ color: Brand.primary, fontSize: 16 }}>
            ← Back
          </ThemedText>
        </TouchableOpacity>

        <View style={styles.content}>
          <ThemedText type="subtitle" style={styles.title}>
            Reset Password
          </ThemedText>

          {sent ? (
            <View style={styles.sentBox}>
              <ThemedText style={styles.sentEmoji}>📧</ThemedText>
              <ThemedText style={styles.sentText}>
                If an account exists with that email, you'll receive a password
                reset link shortly. Check your inbox!
              </ThemedText>
              <TouchableOpacity
                style={styles.button}
                onPress={() => router.replace("/(auth)/sign-in")}
              >
                <ThemedText style={styles.buttonText}>
                  Back to Sign In
                </ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <ThemedText themeColor="textSecondary" style={styles.description}>
                Enter your email address and we'll send you a link to reset your
                password.
              </ThemedText>

              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundElement,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TouchableOpacity
                style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
                onPress={handleReset}
                disabled={loading}
              >
                <ThemedText style={styles.buttonText}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  content: { flex: 1, justifyContent: "center" },
  title: { marginBottom: Spacing.four, textAlign: "center" },
  form: { gap: Spacing.three },
  description: { fontSize: 15, textAlign: "center", marginBottom: Spacing.two },
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
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  sentBox: { alignItems: "center", gap: Spacing.three },
  sentEmoji: { fontSize: 48 },
  sentText: { fontSize: 15, textAlign: "center", lineHeight: 22 },
});
