import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "@/components/themed-text";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";
import { useLesson } from "@/hooks/use-lesson";
import { ExerciseRenderer } from "@/components/exercises/exercise-renderer";
import { getUnit, completeLesson } from "@/lib/api";
import type { Exercise } from "@/lib/types";

export default function LessonScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { unitId, lessonIndex } = useLocalSearchParams<{
    unitId: string;
    lessonIndex: string;
  }>();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [lessonTitle, setLessonTitle] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const unit = await getUnit(unitId);
        const idx = parseInt(lessonIndex, 10);
        if (unit.lessons[idx]) {
          setExercises(unit.lessons[idx].exercises);
          setLessonTitle(unit.lessons[idx].title);
        }
      } catch (error) {
        Alert.alert("Error", "Failed to load lesson");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [unitId, lessonIndex]);

  if (loading) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: theme.background }]}
      >
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  if (exercises.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={styles.centerContainer}>
          <ThemedText type="subtitle">No exercises found</ThemedText>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <ThemedText style={styles.backBtnText}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <LessonContent
      exercises={exercises}
      unitId={unitId}
      lessonIndex={parseInt(lessonIndex, 10)}
      lessonTitle={lessonTitle}
    />
  );
}

function LessonContent({
  exercises,
  unitId,
  lessonIndex,
  lessonTitle,
}: {
  exercises: Exercise[];
  unitId: string;
  lessonIndex: number;
  lessonTitle: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const {
    currentIndex,
    totalExercises,
    currentExercise,
    results,
    isComplete,
    mistakeCount,
    recordResult,
    advance,
  } = useLesson(exercises);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isComplete) {
      submitResults();
    }
  }, [isComplete]);

  const submitResults = async () => {
    setSubmitting(true);
    try {
      await completeLesson({
        unitId,
        lessonIndex,
        results,
        perfectScore: mistakeCount === 0,
      });
    } catch (error) {
      console.error("Failed to submit lesson:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const progress = (currentIndex / totalExercises) * 100;

  if (isComplete) {
    const correctCount = results.filter((r) => r.correct).length;
    const totalCount = results.length;
    const score = Math.round((correctCount / totalCount) * 100);
    const isPerfect = mistakeCount === 0;

    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={styles.completionContainer}>
          <ThemedText style={styles.completionEmoji}>
            {isPerfect ? "🎉" : score >= 70 ? "👏" : "💪"}
          </ThemedText>
          <ThemedText type="title" style={styles.completionTitle}>
            {isPerfect ? "Perfect!" : "Lesson Complete!"}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.completionSubtitle}>
            {lessonTitle}
          </ThemedText>

          <View style={styles.scoreGrid}>
            <View style={[styles.scoreCard, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={[styles.scoreValue, { color: Brand.primary }]}>
                {score}%
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.scoreLabel}>
                Score
              </ThemedText>
            </View>
            <View style={[styles.scoreCard, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={[styles.scoreValue, { color: Brand.primary }]}>
                {correctCount}/{totalCount}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.scoreLabel}>
                Correct
              </ThemedText>
            </View>
          </View>

          {submitting ? (
            <ActivityIndicator
              size="small"
              color={Brand.primary}
              style={{ marginTop: Spacing.three }}
            />
          ) : null}

          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => router.back()}
          >
            <ThemedText style={styles.doneButtonText}>Continue</ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Header with progress */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ThemedText style={styles.closeButton}>✕</ThemedText>
        </TouchableOpacity>

        <View style={[styles.progressContainer, { backgroundColor: theme.backgroundElement }]}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${progress}%`,
                backgroundColor: Brand.primary,
              },
            ]}
          />
        </View>

        <ThemedText themeColor="textSecondary" style={styles.counter}>
          {currentIndex + 1}/{totalExercises}
        </ThemedText>
      </View>

      {/* Exercise Content */}
      <ExerciseRenderer
        key={currentIndex}
        exercise={currentExercise}
        onResult={recordResult}
        onContinue={advance}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.three,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  closeButton: { fontSize: 22, fontWeight: "300", paddingHorizontal: Spacing.one },
  progressContainer: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBar: { height: "100%", borderRadius: 5 },
  counter: { fontSize: 13, fontWeight: "600" },
  // Completion
  completionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.five,
  },
  completionEmoji: { fontSize: 64, marginBottom: Spacing.three },
  completionTitle: { fontSize: 32, marginBottom: Spacing.two, textAlign: "center" },
  completionSubtitle: { fontSize: 16, textAlign: "center", marginBottom: Spacing.five },
  scoreGrid: {
    flexDirection: "row",
    gap: Spacing.three,
    marginBottom: Spacing.five,
  },
  scoreCard: {
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.five,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  scoreValue: { fontSize: 28, fontWeight: "700" },
  scoreLabel: { fontSize: 13, marginTop: Spacing.one },
  doneButton: {
    backgroundColor: Brand.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    paddingHorizontal: Spacing.six,
    width: "100%",
    alignItems: "center",
  },
  doneButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  backBtn: {
    backgroundColor: Brand.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: Spacing.four,
  },
  backBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
