import React, { useState } from "react";
import { View, StyleSheet, TextInput, Platform } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { useExercise } from "@/hooks/use-exercise";
import { ExerciseShell } from "./exercise-shell";
import { BorderRadius, Spacing } from "@/constants/theme";
import type { TranslationExercise } from "@/lib/types";

interface Props {
  exercise: TranslationExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
}

function normalizeString(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"]/g, "")
    .replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function Translation({ exercise, onResult, onContinue }: Props) {
  const theme = useTheme();
  const { status, checkAnswer } = useExercise();
  const [input, setInput] = useState("");

  const handleCheck = () => {
    const normalizedInput = normalizeString(input);
    const normalizedAnswer = normalizeString(exercise.answer);

    // Check exact match first
    let correct = normalizedInput === normalizedAnswer;

    // Check acceptAlso
    if (!correct && exercise.acceptAlso) {
      correct = exercise.acceptAlso.some(
        (alt) => normalizeString(alt) === normalizedInput
      );
    }

    // Fuzzy match (allow small typos)
    if (!correct) {
      const distance = levenshtein(normalizedInput, normalizedAnswer);
      const maxLen = Math.max(normalizedInput.length, normalizedAnswer.length);
      const similarity = 1 - distance / maxLen;
      correct = similarity >= 0.85;
    }

    checkAnswer(correct);
    onResult(correct, input);
  };

  return (
    <ExerciseShell
      status={status}
      canCheck={input.trim().length > 0}
      correctAnswer={exercise.answer}
      onCheck={handleCheck}
      onContinue={onContinue}
    >
      <ThemedText style={styles.prompt}>{exercise.text}</ThemedText>
      <ThemedText style={styles.sentence}>{exercise.sentence}</ThemedText>
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
        placeholder="Type your translation..."
        placeholderTextColor={theme.textTertiary}
        multiline
        editable={status === "answering"}
        autoFocus
      />
    </ExerciseShell>
  );
}

const styles = StyleSheet.create({
  prompt: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.two },
  sentence: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: Spacing.four,
    lineHeight: 30,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.select({ ios: 14, android: 12 }),
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
  },
});
