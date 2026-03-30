import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "@/components/themed-text";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";
import { getDueCards, reviewCard } from "@/lib/api";
import type { SrsCard } from "@/lib/types";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export default function ReviewScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [cards, setCards] = useState<SrsCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewed, setReviewed] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const data = await getDueCards();
        setCards(data);
      } catch {
        console.error("Failed to load due cards");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const currentCard = cards[currentIndex];
  const isComplete = currentIndex >= cards.length;

  const handleReview = async (quality: number) => {
    if (!currentCard) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      await reviewCard(currentCard.word, currentCard.language, quality);
    } catch {
      console.error("Failed to review card");
    }

    setReviewed((r) => r + 1);
    setIsFlipped(false);
    setCurrentIndex((i) => i + 1);
  };

  if (loading) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: theme.background }]}
      >
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  if (cards.length === 0 || isComplete) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={styles.centerContainer}>
          <ThemedText style={styles.emoji}>
            {cards.length === 0 ? "🎉" : "✅"}
          </ThemedText>
          <ThemedText type="subtitle" style={styles.completeTitle}>
            {cards.length === 0
              ? "No cards to review!"
              : `Review Complete!`}
          </ThemedText>
          {reviewed > 0 && (
            <ThemedText themeColor="textSecondary">
              You reviewed {reviewed} card{reviewed !== 1 ? "s" : ""}
            </ThemedText>
          )}
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => router.back()}
          >
            <ThemedText style={styles.doneButtonText}>Done</ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const progress = ((currentIndex + 1) / cards.length) * 100;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ThemedText style={styles.closeButton}>✕</ThemedText>
        </TouchableOpacity>
        <View
          style={[
            styles.progressContainer,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          <View
            style={[
              styles.progressBar,
              { width: `${progress}%`, backgroundColor: Brand.primary },
            ]}
          />
        </View>
        <ThemedText themeColor="textSecondary" style={styles.counter}>
          {currentIndex + 1}/{cards.length}
        </ThemedText>
      </View>

      {/* Card */}
      <View style={styles.cardContainer}>
        <TouchableOpacity
          style={[
            styles.card,
            {
              backgroundColor: isFlipped
                ? Brand.secondary + "08"
                : theme.backgroundElement,
              borderColor: isFlipped ? Brand.secondary : theme.border,
            },
          ]}
          onPress={() => setIsFlipped(!isFlipped)}
          activeOpacity={0.8}
        >
          <ThemedText themeColor="textTertiary" style={styles.cardSide}>
            {isFlipped ? "Translation" : "Word"}
          </ThemedText>
          <ThemedText style={styles.cardWord}>
            {isFlipped ? currentCard.translation : currentCard.word}
          </ThemedText>
          {currentCard.pos && !isFlipped && (
            <ThemedText themeColor="textTertiary" style={styles.cardPos}>
              {currentCard.pos}
              {currentCard.gender ? ` (${currentCard.gender})` : ""}
            </ThemedText>
          )}
          {!isFlipped && (
            <ThemedText themeColor="textTertiary" style={styles.tapHint}>
              Tap to reveal
            </ThemedText>
          )}
        </TouchableOpacity>
      </View>

      {/* Rating buttons (shown when flipped) */}
      {isFlipped && (
        <View style={styles.ratingContainer}>
          <ThemedText style={styles.ratingLabel}>How well did you know it?</ThemedText>
          <View style={styles.ratingButtons}>
            <TouchableOpacity
              style={[styles.ratingButton, { backgroundColor: Brand.danger + "15", borderColor: Brand.danger }]}
              onPress={() => handleReview(1)}
            >
              <ThemedText style={[styles.ratingEmoji]}>😫</ThemedText>
              <ThemedText style={[styles.ratingText, { color: Brand.danger }]}>Again</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ratingButton, { backgroundColor: Brand.warning + "15", borderColor: Brand.warning }]}
              onPress={() => handleReview(3)}
            >
              <ThemedText style={styles.ratingEmoji}>🤔</ThemedText>
              <ThemedText style={[styles.ratingText, { color: Brand.warningDark }]}>Hard</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ratingButton, { backgroundColor: Brand.secondary + "15", borderColor: Brand.secondary }]}
              onPress={() => handleReview(4)}
            >
              <ThemedText style={styles.ratingEmoji}>🙂</ThemedText>
              <ThemedText style={[styles.ratingText, { color: Brand.secondary }]}>Good</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ratingButton, { backgroundColor: Brand.primary + "15", borderColor: Brand.primary }]}
              onPress={() => handleReview(5)}
            >
              <ThemedText style={styles.ratingEmoji}>😎</ThemedText>
              <ThemedText style={[styles.ratingText, { color: Brand.primary }]}>Easy</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
  },
  emoji: { fontSize: 48 },
  completeTitle: { textAlign: "center" },
  doneButton: {
    backgroundColor: Brand.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.five,
    marginTop: Spacing.three,
  },
  doneButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  closeButton: { fontSize: 22, fontWeight: "300", paddingHorizontal: Spacing.one },
  progressContainer: { flex: 1, height: 10, borderRadius: 5, overflow: "hidden" },
  progressBar: { height: "100%", borderRadius: 5 },
  counter: { fontSize: 13, fontWeight: "600" },
  // Card
  cardContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
  },
  card: {
    minHeight: 250,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    padding: Spacing.five,
    justifyContent: "center",
    alignItems: "center",
  },
  cardSide: { fontSize: 12, textTransform: "uppercase", marginBottom: Spacing.two },
  cardWord: { fontSize: 32, fontWeight: "700", textAlign: "center", lineHeight: 42 },
  cardPos: { fontSize: 14, marginTop: Spacing.two },
  tapHint: { fontSize: 13, marginTop: Spacing.four },
  // Rating
  ratingContainer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  ratingLabel: { fontSize: 15, fontWeight: "600", textAlign: "center" },
  ratingButtons: { flexDirection: "row", gap: Spacing.two },
  ratingButton: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: "center",
    gap: Spacing.one,
  },
  ratingEmoji: { fontSize: 20 },
  ratingText: { fontSize: 12, fontWeight: "700" },
});
