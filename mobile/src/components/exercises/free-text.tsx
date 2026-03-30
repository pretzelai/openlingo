import React, { useState } from "react";
import { View, StyleSheet, TextInput, Platform } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { useExercise } from "@/hooks/use-exercise";
import { ExerciseShell } from "./exercise-shell";
import { BorderRadius, Spacing } from "@/constants/theme";
import type { FreeTextExercise } from "@/lib/types";

interface Props {
  exercise: FreeTextExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
}

export function FreeText({ exercise, onResult, onContinue }: Props) {
  const theme = useTheme();
  const { status, checkAnswer } = useExercise();
  const [input, setInput] = useState("");

  const handleCheck = () => {
    // Free text exercises are always "correct" - they're for practice
    const hasContent = input.trim().length > 5;
    checkAnswer(hasContent);
    onResult(hasContent, input);
  };

  return (
    <ExerciseShell
      status={status}
      canCheck={input.trim().length > 0}
      onCheck={handleCheck}
      onContinue={onContinue}
    >
      <ThemedText style={styles.prompt}>{exercise.text}</ThemedText>

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundElement,
            color: theme.text,
            borderColor: theme.border,
          },
        ]}
        value={input}
        onChangeText={setInput}
        placeholder="Write your answer..."
        placeholderTextColor={theme.textTertiary}
        multiline
        editable={status === "answering"}
        autoFocus
        textAlignVertical="top"
      />

      {status !== "answering" && exercise.afterSubmitPrompt && (
        <View style={[styles.feedbackBox, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.feedbackLabel}>Feedback</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.feedbackText}>
            {exercise.afterSubmitPrompt}
          </ThemedText>
        </View>
      )}
    </ExerciseShell>
  );
}

const styles = StyleSheet.create({
  prompt: { fontSize: 20, fontWeight: "600", marginBottom: Spacing.four, lineHeight: 28 },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.select({ ios: 14, android: 12 }),
    fontSize: 16,
    minHeight: 120,
  },
  feedbackBox: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
  },
  feedbackLabel: { fontSize: 14, fontWeight: "700", marginBottom: Spacing.one },
  feedbackText: { fontSize: 14, lineHeight: 20 },
});
