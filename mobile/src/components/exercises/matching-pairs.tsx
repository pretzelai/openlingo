import React, { useState, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { useExercise } from "@/hooks/use-exercise";
import { ExerciseShell } from "./exercise-shell";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";
import type { MatchingPairsExercise } from "@/lib/types";

interface Props {
  exercise: MatchingPairsExercise;
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

export function MatchingPairs({ exercise, onResult, onContinue }: Props) {
  const theme = useTheme();
  const { status, checkAnswer } = useExercise();

  const leftItems = useMemo(
    () => exercise.pairs.map((p, i) => ({ text: p.left, index: i })),
    [exercise.pairs]
  );

  const rightItems = useMemo(
    () => shuffle(exercise.pairs.map((p, i) => ({ text: p.right, index: i }))),
    [exercise.pairs]
  );

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<Map<number, number>>(new Map());
  const [wrongPair, setWrongPair] = useState<[number, number] | null>(null);

  const handleLeftPress = (index: number) => {
    if (status !== "answering" || matches.has(index)) return;
    setSelectedLeft(index);
    setWrongPair(null);
  };

  const handleRightPress = (rightIdx: number) => {
    if (status !== "answering" || selectedLeft === null) return;

    const rightItem = rightItems[rightIdx];
    if ([...matches.values()].includes(rightIdx)) return;

    if (selectedLeft === rightItem.index) {
      // Correct match
      const newMatches = new Map(matches);
      newMatches.set(selectedLeft, rightIdx);
      setMatches(newMatches);
      setSelectedLeft(null);
      setWrongPair(null);

      // Check if all matched
      if (newMatches.size === exercise.pairs.length) {
        checkAnswer(true);
        onResult(true, "all matched");
      }
    } else {
      // Wrong match
      setWrongPair([selectedLeft, rightIdx]);
      setTimeout(() => {
        setWrongPair(null);
        setSelectedLeft(null);
      }, 600);
    }
  };

  const allMatched = matches.size === exercise.pairs.length;

  return (
    <ExerciseShell
      status={status}
      canCheck={false} // Auto-checks when all pairs matched
      onCheck={() => {}}
      onContinue={onContinue}
    >
      <ThemedText style={styles.label}>Match the pairs</ThemedText>

      <View style={styles.columns}>
        {/* Left Column */}
        <View style={styles.column}>
          {leftItems.map((item) => {
            const isMatched = matches.has(item.index);
            const isSelected = selectedLeft === item.index;
            const isWrong = wrongPair?.[0] === item.index;

            return (
              <TouchableOpacity
                key={`l-${item.index}`}
                style={[
                  styles.pairCard,
                  {
                    backgroundColor: isMatched
                      ? theme.successBg
                      : isWrong
                        ? theme.errorBg
                        : isSelected
                          ? Brand.primary + "15"
                          : theme.backgroundElement,
                    borderColor: isMatched
                      ? Brand.primary
                      : isWrong
                        ? Brand.danger
                        : isSelected
                          ? Brand.primary
                          : theme.border,
                    opacity: isMatched ? 0.6 : 1,
                  },
                ]}
                onPress={() => handleLeftPress(item.index)}
                disabled={isMatched || status !== "answering"}
              >
                <ThemedText style={styles.pairText}>{item.text}</ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Right Column */}
        <View style={styles.column}>
          {rightItems.map((item, idx) => {
            const isMatched = [...matches.values()].includes(idx);
            const isWrong = wrongPair?.[1] === idx;

            return (
              <TouchableOpacity
                key={`r-${idx}`}
                style={[
                  styles.pairCard,
                  {
                    backgroundColor: isMatched
                      ? theme.successBg
                      : isWrong
                        ? theme.errorBg
                        : theme.backgroundElement,
                    borderColor: isMatched
                      ? Brand.primary
                      : isWrong
                        ? Brand.danger
                        : theme.border,
                    opacity: isMatched ? 0.6 : 1,
                  },
                ]}
                onPress={() => handleRightPress(idx)}
                disabled={isMatched || status !== "answering" || selectedLeft === null}
              >
                <ThemedText style={styles.pairText}>{item.text}</ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ExerciseShell>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.three },
  columns: { flexDirection: "row", gap: Spacing.two },
  column: { flex: 1, gap: Spacing.two },
  pairCard: {
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: "center",
  },
  pairText: { fontSize: 15, fontWeight: "500", textAlign: "center" },
});
