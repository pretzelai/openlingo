import React, { useState } from "react";
import { View, StyleSheet, TextInput, Platform } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { useExercise } from "@/hooks/use-exercise";
import { ExerciseShell } from "./exercise-shell";
import { BorderRadius, Spacing } from "@/constants/theme";
import type { FillInTheBlankExercise } from "@/lib/types";

interface Props {
  exercise: FillInTheBlankExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
}

export function FillInTheBlank({ exercise, onResult, onContinue }: Props) {
  const theme = useTheme();
  const { status, checkAnswer } = useExercise();
  const [input, setInput] = useState("");

  const handleCheck = () => {
    const normalized = input.trim().toLowerCase();
    const answer = exercise.blank.trim().toLowerCase();
    const correct = normalized === answer;
    checkAnswer(correct);
    onResult(correct, input);
  };

  // Split sentence around ___
  const parts = exercise.sentence.split("___");

  return (
    <ExerciseShell
      status={status}
      canCheck={input.trim().length > 0}
      correctAnswer={exercise.blank}
      onCheck={handleCheck}
      onContinue={onContinue}
    >
      <ThemedText style={styles.label}>Fill in the blank</ThemedText>
      <View style={styles.sentenceContainer}>
        <ThemedText style={styles.sentence}>
          {parts[0]}
          <ThemedText style={styles.blankHighlight}>
            {status !== "answering" ? exercise.blank : "___"}
          </ThemedText>
          {parts[1] || ""}
        </ThemedText>
      </View>

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
        placeholder="Type the missing word..."
        placeholderTextColor={theme.textTertiary}
        editable={status === "answering"}
        autoFocus
        autoCapitalize="none"
      />
    </ExerciseShell>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.three },
  sentenceContainer: { marginBottom: Spacing.four },
  sentence: { fontSize: 20, lineHeight: 30 },
  blankHighlight: { fontWeight: "700", textDecorationLine: "underline" },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.select({ ios: 14, android: 12 }),
    fontSize: 18,
    textAlign: "center",
  },
});
