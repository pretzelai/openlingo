import React, { useState, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { useExercise } from "@/hooks/use-exercise";
import { ExerciseShell } from "./exercise-shell";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";
import type { MultipleChoiceExercise } from "@/lib/types";

interface Props {
  exercise: MultipleChoiceExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
}

export function MultipleChoice({ exercise, onResult, onContinue }: Props) {
  const theme = useTheme();
  const { status, checkAnswer } = useExercise();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const shuffledChoices = useMemo(() => {
    if (!exercise.randomOrder) return exercise.choices.map((c, i) => ({ choice: c, originalIndex: i }));
    const indexed = exercise.choices.map((c, i) => ({ choice: c, originalIndex: i }));
    for (let i = indexed.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
    }
    return indexed;
  }, [exercise.choices, exercise.randomOrder]);

  const handleCheck = () => {
    if (selectedIndex === null) return;
    const chosen = shuffledChoices[selectedIndex];
    const correct = chosen.originalIndex === exercise.correctIndex;
    checkAnswer(correct);
    onResult(correct, chosen.choice);
  };

  const getChoiceStyle = (index: number) => {
    if (status === "answering") {
      return {
        backgroundColor: index === selectedIndex ? Brand.primary + "15" : theme.backgroundElement,
        borderColor: index === selectedIndex ? Brand.primary : theme.border,
      };
    }
    const chosen = shuffledChoices[index];
    if (chosen.originalIndex === exercise.correctIndex) {
      return { backgroundColor: theme.successBg, borderColor: Brand.primary };
    }
    if (index === selectedIndex && status === "incorrect") {
      return { backgroundColor: theme.errorBg, borderColor: Brand.danger };
    }
    return { backgroundColor: theme.backgroundElement, borderColor: theme.border };
  };

  return (
    <ExerciseShell
      status={status}
      canCheck={selectedIndex !== null}
      correctAnswer={exercise.choices[exercise.correctIndex]}
      onCheck={handleCheck}
      onContinue={onContinue}
    >
      <ThemedText style={styles.questionText}>{exercise.text}</ThemedText>
      <View style={styles.choices}>
        {shuffledChoices.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.choiceButton, getChoiceStyle(index)]}
            onPress={() => status === "answering" && setSelectedIndex(index)}
            disabled={status !== "answering"}
          >
            <ThemedText style={styles.choiceText}>{item.choice}</ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </ExerciseShell>
  );
}

const styles = StyleSheet.create({
  questionText: { fontSize: 20, fontWeight: "600", marginBottom: Spacing.four, lineHeight: 28 },
  choices: { gap: Spacing.two },
  choiceButton: {
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  choiceText: { fontSize: 16 },
});
