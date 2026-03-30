import React, { useState, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { useExercise } from "@/hooks/use-exercise";
import { ExerciseShell } from "./exercise-shell";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";
import type { WordBankExercise } from "@/lib/types";

interface Props {
  exercise: WordBankExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function WordBank({ exercise, onResult, onContinue }: Props) {
  const theme = useTheme();
  const { status, checkAnswer } = useExercise();

  const shuffledWords = useMemo(
    () =>
      exercise.randomOrder !== false
        ? shuffle(exercise.words)
        : exercise.words,
    [exercise.words, exercise.randomOrder]
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>(shuffledWords);

  const handleSelectWord = (word: string, index: number) => {
    if (status !== "answering") return;
    setSelected([...selected, word]);
    const newAvailable = [...available];
    newAvailable.splice(index, 1);
    setAvailable(newAvailable);
  };

  const handleDeselectWord = (word: string, index: number) => {
    if (status !== "answering") return;
    const newSelected = [...selected];
    newSelected.splice(index, 1);
    setSelected(newSelected);
    setAvailable([...available, word]);
  };

  const handleCheck = () => {
    const correct =
      selected.length === exercise.answer.length &&
      selected.every((w, i) => w === exercise.answer[i]);
    checkAnswer(correct);
    onResult(correct, selected.join(" "));
  };

  return (
    <ExerciseShell
      status={status}
      canCheck={selected.length > 0}
      correctAnswer={exercise.answer.join(" ")}
      onCheck={handleCheck}
      onContinue={onContinue}
    >
      <ThemedText style={styles.prompt}>{exercise.text}</ThemedText>

      {/* Selected words area */}
      <View
        style={[
          styles.selectedArea,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
          },
        ]}
      >
        {selected.length === 0 ? (
          <ThemedText themeColor="textTertiary" style={styles.placeholder}>
            Tap words to build your answer
          </ThemedText>
        ) : (
          <View style={styles.wordRow}>
            {selected.map((word, index) => (
              <TouchableOpacity
                key={`s-${index}`}
                style={[
                  styles.wordChip,
                  {
                    backgroundColor: Brand.primary + "15",
                    borderColor: Brand.primary,
                  },
                ]}
                onPress={() => handleDeselectWord(word, index)}
              >
                <ThemedText
                  style={[styles.wordChipText, { color: Brand.primary }]}
                >
                  {word}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Available words */}
      <View style={styles.wordRow}>
        {available.map((word, index) => (
          <TouchableOpacity
            key={`a-${index}`}
            style={[
              styles.wordChip,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}
            onPress={() => handleSelectWord(word, index)}
            disabled={status !== "answering"}
          >
            <ThemedText style={styles.wordChipText}>{word}</ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </ExerciseShell>
  );
}

const styles = StyleSheet.create({
  prompt: { fontSize: 20, fontWeight: "600", marginBottom: Spacing.four, lineHeight: 28 },
  selectedArea: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    borderStyle: "dashed",
    padding: Spacing.two,
    marginBottom: Spacing.four,
    justifyContent: "center",
  },
  placeholder: { textAlign: "center", fontSize: 14 },
  wordRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  wordChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  wordChipText: { fontSize: 16, fontWeight: "500" },
});
