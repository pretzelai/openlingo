import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, TextInput, Platform } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { useExercise } from "@/hooks/use-exercise";
import { ExerciseShell } from "./exercise-shell";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";
import type { ListeningExercise } from "@/lib/types";

interface Props {
  exercise: ListeningExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
}

export function Listening({ exercise, onResult, onContinue }: Props) {
  const theme = useTheme();
  const { status, checkAnswer } = useExercise();
  const [input, setInput] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const isChoiceMode = exercise.mode === "choices" && exercise.choices;

  const handleCheck = () => {
    if (isChoiceMode && selectedIndex !== null) {
      const correct = selectedIndex === exercise.correctIndex;
      checkAnswer(correct);
      onResult(correct, exercise.choices![selectedIndex]);
    } else {
      const normalized = input.trim().toLowerCase();
      const answer = exercise.text.trim().toLowerCase();
      const correct = normalized === answer;
      checkAnswer(correct);
      onResult(correct, input);
    }
  };

  const canCheck = isChoiceMode ? selectedIndex !== null : input.trim().length > 0;

  return (
    <ExerciseShell
      status={status}
      canCheck={canCheck}
      correctAnswer={
        isChoiceMode
          ? exercise.choices![exercise.correctIndex!]
          : exercise.text
      }
      onCheck={handleCheck}
      onContinue={onContinue}
    >
      <ThemedText style={styles.label}>Listen and answer</ThemedText>

      {/* Audio play button */}
      <TouchableOpacity
        style={[styles.playButton, { backgroundColor: Brand.secondary + "15", borderColor: Brand.secondary }]}
      >
        <ThemedText style={styles.playIcon}>🔊</ThemedText>
        <ThemedText style={[styles.playText, { color: Brand.secondary }]}>
          Play Audio
        </ThemedText>
      </TouchableOpacity>

      {isChoiceMode ? (
        <View style={styles.choices}>
          {exercise.choices!.map((choice, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.choiceButton,
                {
                  backgroundColor:
                    index === selectedIndex
                      ? Brand.primary + "15"
                      : theme.backgroundElement,
                  borderColor:
                    index === selectedIndex ? Brand.primary : theme.border,
                },
              ]}
              onPress={() => status === "answering" && setSelectedIndex(index)}
              disabled={status !== "answering"}
            >
              <ThemedText style={styles.choiceText}>{choice}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
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
          placeholder="Type what you hear..."
          placeholderTextColor={theme.textTertiary}
          editable={status === "answering"}
          autoFocus
        />
      )}
    </ExerciseShell>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.three },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    marginBottom: Spacing.four,
    gap: Spacing.two,
  },
  playIcon: { fontSize: 32 },
  playText: { fontSize: 16, fontWeight: "700" },
  choices: { gap: Spacing.two },
  choiceButton: {
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  choiceText: { fontSize: 16 },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.select({ ios: 14, android: 12 }),
    fontSize: 16,
  },
});
