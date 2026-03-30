import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { useExercise } from "@/hooks/use-exercise";
import { ExerciseShell } from "./exercise-shell";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";
import type { FlashcardReviewExercise } from "@/lib/types";

interface Props {
  exercise: FlashcardReviewExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
}

export function FlashcardReview({ exercise, onResult, onContinue }: Props) {
  const theme = useTheme();
  const { status, checkAnswer } = useExercise();
  const [isFlipped, setIsFlipped] = useState(false);
  const [selfAssessment, setSelfAssessment] = useState<boolean | null>(null);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleSelfAssess = (knew: boolean) => {
    setSelfAssessment(knew);
    checkAnswer(knew);
    onResult(knew, knew ? "knew it" : "didn't know");
  };

  return (
    <ExerciseShell
      status={status}
      canCheck={false}
      onCheck={() => {}}
      onContinue={onContinue}
    >
      <ThemedText style={styles.label}>Flashcard Review</ThemedText>

      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: isFlipped
              ? Brand.secondary + "10"
              : theme.backgroundElement,
            borderColor: isFlipped ? Brand.secondary : theme.border,
          },
        ]}
        onPress={handleFlip}
        activeOpacity={0.8}
      >
        <ThemedText themeColor="textTertiary" style={styles.cardSide}>
          {isFlipped ? "Back" : "Front"}
        </ThemedText>
        <ThemedText style={styles.cardText}>
          {isFlipped ? exercise.back : exercise.front}
        </ThemedText>
        {!isFlipped && (
          <ThemedText themeColor="textTertiary" style={styles.tapHint}>
            Tap to flip
          </ThemedText>
        )}
      </TouchableOpacity>

      {isFlipped && status === "answering" && (
        <View style={styles.assessmentRow}>
          <ThemedText style={styles.assessLabel}>Did you know it?</ThemedText>
          <View style={styles.assessButtons}>
            <TouchableOpacity
              style={[
                styles.assessButton,
                { backgroundColor: Brand.danger + "15", borderColor: Brand.danger },
              ]}
              onPress={() => handleSelfAssess(false)}
            >
              <ThemedText style={[styles.assessButtonText, { color: Brand.danger }]}>
                ✗ No
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.assessButton,
                { backgroundColor: Brand.primary + "15", borderColor: Brand.primary },
              ]}
              onPress={() => handleSelfAssess(true)}
            >
              <ThemedText style={[styles.assessButtonText, { color: Brand.primary }]}>
                ✓ Yes
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ExerciseShell>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.three },
  card: {
    minHeight: 200,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    padding: Spacing.four,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.four,
  },
  cardSide: { fontSize: 12, textTransform: "uppercase", marginBottom: Spacing.two },
  cardText: { fontSize: 28, fontWeight: "700", textAlign: "center", lineHeight: 38 },
  tapHint: { fontSize: 13, marginTop: Spacing.three },
  assessmentRow: { gap: Spacing.two },
  assessLabel: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  assessButtons: { flexDirection: "row", gap: Spacing.three },
  assessButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: "center",
  },
  assessButtonText: { fontSize: 16, fontWeight: "700" },
});
