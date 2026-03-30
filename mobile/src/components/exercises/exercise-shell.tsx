import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";
import type { ExerciseStatus } from "@/hooks/use-exercise";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

interface ExerciseShellProps {
  status: ExerciseStatus;
  canCheck: boolean;
  correctAnswer?: string;
  onCheck: () => void;
  onContinue: () => void;
  children: React.ReactNode;
}

export function ExerciseShell({
  status,
  canCheck,
  correctAnswer,
  onCheck,
  onContinue,
  children,
}: ExerciseShellProps) {
  const theme = useTheme();

  const handleCheck = () => {
    onCheck();
  };

  const handleContinue = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(
        status === "correct"
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Medium
      );
    }
    onContinue();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>{children}</View>

      <View style={styles.footer}>
        {status !== "answering" && (
          <View
            style={[
              styles.feedbackBanner,
              {
                backgroundColor:
                  status === "correct" ? theme.successBg : theme.errorBg,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.feedbackText,
                {
                  color:
                    status === "correct" ? Brand.primary : Brand.danger,
                },
              ]}
            >
              {status === "correct" ? "✓ Correct!" : "✗ Incorrect"}
            </ThemedText>
            {status === "incorrect" && correctAnswer && (
              <ThemedText
                style={[styles.correctAnswer, { color: Brand.danger }]}
              >
                Correct answer: {correctAnswer}
              </ThemedText>
            )}
          </View>
        )}

        {status === "answering" ? (
          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor: canCheck
                  ? Brand.primary
                  : theme.backgroundSelected,
              },
            ]}
            onPress={handleCheck}
            disabled={!canCheck}
          >
            <ThemedText
              style={[
                styles.buttonText,
                { color: canCheck ? "#FFFFFF" : theme.textTertiary },
              ]}
            >
              Check
            </ThemedText>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor:
                  status === "correct" ? Brand.primary : Brand.danger,
              },
            ]}
            onPress={handleContinue}
          >
            <ThemedText style={styles.buttonText}>Continue</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  feedbackBanner: {
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.three,
  },
  feedbackText: { fontSize: 18, fontWeight: "700" },
  correctAnswer: { fontSize: 14, marginTop: Spacing.one },
  button: {
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  buttonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
});
