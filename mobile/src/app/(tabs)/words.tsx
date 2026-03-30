import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "@/components/themed-text";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";
import { getAllCards, getSrsStats, getDueCards } from "@/lib/api";
import type { SrsCard, SrsStats } from "@/lib/types";

export default function WordsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [cards, setCards] = useState<SrsCard[]>([]);
  const [stats, setStats] = useState<SrsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [cardsData, statsData] = await Promise.all([
        getAllCards(),
        getSrsStats(),
      ]);
      setCards(cardsData);
      setStats(statsData);
    } catch (error) {
      console.error("Failed to fetch words:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return Brand.secondary;
      case "learning":
        return Brand.warning;
      case "review":
        return Brand.primary;
      default:
        return theme.textSecondary;
    }
  };

  const renderCard = ({ item }: { item: SrsCard }) => (
    <View
      style={[
        styles.wordCard,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.wordHeader}>
        <ThemedText style={styles.word}>{item.word}</ThemedText>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) + "20" },
          ]}
        >
          <ThemedText
            style={[
              styles.statusText,
              { color: getStatusColor(item.status) },
            ]}
          >
            {item.status}
          </ThemedText>
        </View>
      </View>
      <ThemedText themeColor="textSecondary" style={styles.translation}>
        {item.translation}
      </ThemedText>
      <View style={styles.wordMeta}>
        {item.pos && (
          <ThemedText themeColor="textTertiary" style={styles.metaText}>
            {item.pos}
          </ThemedText>
        )}
        {item.cefrLevel && (
          <ThemedText themeColor="textTertiary" style={styles.metaText}>
            {item.cefrLevel}
          </ThemedText>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: theme.background }]}
      >
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Stats Header */}
      {stats && (
        <View style={[styles.statsRow, { borderBottomColor: theme.border }]}>
          <StatBox label="Total" value={stats.total} color={theme.text} />
          <StatBox label="Due" value={stats.due} color={Brand.danger} />
          <StatBox label="New" value={stats.new} color={Brand.secondary} />
          <StatBox
            label="Learning"
            value={stats.learning}
            color={Brand.warning}
          />
          <StatBox label="Review" value={stats.review} color={Brand.primary} />
        </View>
      )}

      {/* Review Button */}
      {stats && stats.due > 0 && (
        <TouchableOpacity
          style={styles.reviewButton}
          onPress={() => router.push("/review")}
        >
          <ThemedText style={styles.reviewButtonText}>
            Review {stats.due} due card{stats.due !== 1 ? "s" : ""}
          </ThemedText>
        </TouchableOpacity>
      )}

      {cards.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyEmoji}>📝</ThemedText>
          <ThemedText type="subtitle" style={styles.emptyTitle}>
            No words yet
          </ThemedText>
          <ThemedText
            themeColor="textSecondary"
            style={styles.emptyDescription}
          >
            Complete lessons to add words to your vocabulary, or ask the AI to
            add words for you!
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={cards}
          renderItem={renderCard}
          keyExtractor={(item) => `${item.word}-${item.language}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchData();
              }}
              tintColor={Brand.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.statBox}>
      <ThemedText style={[styles.statValue, { color }]}>{value}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.statLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  // Stats
  statsRow: {
    flexDirection: "row",
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
  },
  statBox: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 11, marginTop: 2 },
  // Review Button
  reviewButton: {
    margin: Spacing.three,
    backgroundColor: Brand.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  reviewButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  // List
  listContent: { padding: Spacing.three, gap: Spacing.two },
  wordCard: {
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  wordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  word: { fontSize: 18, fontWeight: "700" },
  statusBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  translation: { fontSize: 14, marginTop: Spacing.one },
  wordMeta: { flexDirection: "row", gap: Spacing.two, marginTop: Spacing.one },
  metaText: { fontSize: 12 },
  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.five,
  },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.three },
  emptyTitle: { marginBottom: Spacing.two, textAlign: "center" },
  emptyDescription: { fontSize: 15, textAlign: "center" },
});
