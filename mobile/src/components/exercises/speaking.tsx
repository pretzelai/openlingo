import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, TextInput, Platform } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { useExercise } from "@/hooks/use-exercise";
import { ExerciseShell } from "./exercise-shell";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";
import type { SpeakingExercise } from "@/lib/types";

interface Props {
  exercise: SpeakingExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
}

export function Speaking({ exercise, onResult, onContinue }: Props) {
  const theme = useTheme();
  const { status, checkAnswer } = useExercise();
  const [input, setInput] = useState("");
  const [isTypingMode, setIsTypingMode] = useState(false);

  const handleCheck = () => {
    // In mobile, we fall back to typing mode since STT needs native setup
    const normalized = input.trim().toLowerCase().replace(/[.,!?]/g, "");
    const answer = exercise.sentence
      .trim()
      .toLowerCase()
      .replace(/[.,!?]/g, "");
    const correct = normalized === answer;
    checkAnswer(correct);
    onResult(correct, input);
  };

  return (
    <ExerciseShell
      status={status}
      canCheck={input.trim().length > 0}
      correctAnswer={exercise.sentence}
      onCheck={handleCheck}
      onContinue={onContinue}
    >
      <ThemedText style={styles.label}>Speak this sentence</ThemedText>
      <ThemedText style={styles.sentence}>{exercise.sentence}</ThemedText>

      {!isTypingMode ? (
        <View style={styles.micContainer}>
          <TouchableOpacity
            style={[
              styles.micButton,
              { backgroundColor: Brand.secondary + "15", borderColor: Brand.secondary },
            ]}
          >
            <ThemedText style={styles.micIcon}>🎤</ThemedText>
            <ThemedText style={[styles.micText, { color: Brand.secondary }]}>
              Tap to speak
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsTypingMode(true)}>
            <ThemedText
              themeColor="textSecondary"
              style={styles.switchModeText}
            >
              Can't use microphone? Type instead
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
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
            placeholder="Type the sentence..."
            placeholderTextColor={theme.textTertiary}
            editable={status === "answering"}
            autoFocus
          />
          <TouchableOpacity onPress={() => setIsTypingMode(false)}>
            <ThemedText
              themeColor="textSecondary"
              style={styles.switchModeText}
            >
              Switch to speaking
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </ExerciseShell>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.three },
  sentence: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: Spacing.five,
    lineHeight: 30,
  },
  micContainer: { alignItems: "center", gap: Spacing.three },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.one,
  },
  micIcon: { fontSize: 40 },
  micText: { fontSize: 13, fontWeight: "600" },
  switchModeText: { fontSize: 13, textAlign: "center", marginTop: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.select({ ios: 14, android: 12 }),
    fontSize: 16,
  },
});
