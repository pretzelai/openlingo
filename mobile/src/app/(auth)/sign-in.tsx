import React, { useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Link } from "expo-router";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "@/components/themed-text";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";

export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      router.replace("/(tabs)/chat");
    } catch (e: any) {
      Alert.alert("Sign In Failed", e.message || "Please check your credentials");
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
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <ThemedText style={styles.logo}>🌍</ThemedText>
            <ThemedText type="title" style={styles.title}>
              Welcome back
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Sign in to continue learning
            </ThemedText>
          </View>

          <View style={styles.form}>
            <View>
              <ThemedText style={styles.label}>Email</ThemedText>
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
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
              />
            </View>

            <View>
              <ThemedText style={styles.label}>Password</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundElement,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={theme.textTertiary}
                secureTextEntry
                textContentType="password"
              />
            </View>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/forgot-password")}
            >
              <ThemedText style={[styles.linkText, { color: Brand.secondary }]}>
                Forgot password?
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
              onPress={handleSignIn}
              disabled={loading}
            >
              <ThemedText style={styles.buttonText}>
                {loading ? "Signing in..." : "Sign In"}
              </ThemedText>
            </TouchableOpacity>

            <View style={styles.footer}>
              <ThemedText themeColor="textSecondary">
                Don't have an account?{" "}
              </ThemedText>
              <TouchableOpacity
                onPress={() => router.push("/(auth)/sign-up")}
              >
                <ThemedText style={{ color: Brand.primary, fontWeight: "600" }}>
                  Sign Up
                </ThemedText>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/server-config")}
              style={styles.serverLink}
            >
              <ThemedText
                themeColor="textTertiary"
                style={styles.serverLinkText}
              >
                Change server
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.five,
  },
  logo: { fontSize: 48, marginBottom: Spacing.three },
  title: { fontSize: 32, fontWeight: "700", marginBottom: Spacing.two },
  subtitle: { fontSize: 16, textAlign: "center" },
  form: { gap: Spacing.three },
  label: { fontSize: 14, fontWeight: "600", marginBottom: Spacing.one },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.select({ ios: 14, android: 12 }),
    fontSize: 16,
  },
  linkText: { fontSize: 14, textAlign: "right" },
  button: {
    backgroundColor: Brand.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: Spacing.two,
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.three,
  },
  serverLink: {
    alignItems: "center",
    marginTop: Spacing.two,
  },
  serverLinkText: { fontSize: 13 },
});
