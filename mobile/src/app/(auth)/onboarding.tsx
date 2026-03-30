import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "@/components/themed-text";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";
import {
  supportedLanguages,
  nativeLanguages,
  getLanguageFlag,
} from "@/lib/languages";
import { updateTargetLanguage, updateNativeLanguage } from "@/lib/api";

type Step = "native" | "target";

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [step, setStep] = useState<Step>("native");
  const [selectedNative, setSelectedNative] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (step === "native") {
      if (!selectedNative) {
        Alert.alert("Select a language", "Please select your native language");
        return;
      }
      setStep("target");
      return;
    }

    if (!selectedTarget) {
      Alert.alert(
        "Select a language",
        "Please select a language you want to learn"
      );
      return;
    }

    setLoading(true);
    try {
      await Promise.all([
        updateNativeLanguage(selectedNative!),
        updateTargetLanguage(selectedTarget),
      ]);
      router.replace("/(tabs)/chat");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save preferences");
    } finally {
      setLoading(false);
    }
  };

  const languages =
    step === "native"
      ? Object.entries(nativeLanguages)
      : Object.entries(supportedLanguages).filter(
          ([code]) => code !== selectedNative
        );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <ThemedText type="subtitle" style={styles.title}>
          {step === "native"
            ? "What's your native language?"
            : "What do you want to learn?"}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          {step === "native"
            ? "This helps us give you better translations"
            : "Choose the language you want to master"}
        </ThemedText>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        {languages.map(([code, name]) => {
          const isSelected =
            step === "native"
              ? selectedNative === code
              : selectedTarget === code;
          return (
            <TouchableOpacity
              key={code}
              style={[
                styles.languageCard,
                {
                  backgroundColor: isSelected
                    ? `${Brand.primary}15`
                    : theme.backgroundElement,
                  borderColor: isSelected ? Brand.primary : theme.border,
                },
              ]}
              onPress={() =>
                step === "native"
                  ? setSelectedNative(code)
                  : setSelectedTarget(code)
              }
            >
              <ThemedText style={styles.flag}>
                {getLanguageFlag(code)}
              </ThemedText>
              <ThemedText
                style={[
                  styles.languageName,
                  isSelected && { color: Brand.primary, fontWeight: "700" },
                ]}
              >
                {name}
              </ThemedText>
              {isSelected && (
                <ThemedText style={styles.check}>✓</ThemedText>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        {step === "target" && (
          <TouchableOpacity
            style={[styles.backButton, { borderColor: theme.border }]}
            onPress={() => setStep("native")}
          >
            <ThemedText style={styles.backButtonText}>Back</ThemedText>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.continueButton,
            {
              opacity:
                loading ||
                (step === "native" && !selectedNative) ||
                (step === "target" && !selectedTarget)
                  ? 0.5
                  : 1,
              flex: step === "target" ? 1 : undefined,
            },
          ]}
          onPress={handleContinue}
          disabled={
            loading ||
            (step === "native" && !selectedNative) ||
            (step === "target" && !selectedTarget)
          }
        >
          <ThemedText style={styles.continueButtonText}>
            {loading
              ? "Saving..."
              : step === "native"
                ? "Continue"
                : "Start Learning!"}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.three,
  },
  title: { marginBottom: Spacing.two },
  subtitle: { fontSize: 15 },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  languageCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: Spacing.three,
  },
  flag: { fontSize: 28 },
  languageName: { flex: 1, fontSize: 16, fontWeight: "500" },
  check: { fontSize: 18, color: Brand.primary, fontWeight: "700" },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    flexDirection: "row",
    gap: Spacing.two,
  },
  backButton: {
    borderWidth: 2,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
  },
  backButtonText: { fontSize: 16, fontWeight: "600" },
  continueButton: {
    backgroundColor: Brand.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.five,
    alignItems: "center",
    flex: 1,
  },
  continueButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
