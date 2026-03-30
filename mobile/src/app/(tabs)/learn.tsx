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
import { getUnits } from "@/lib/api";
import { getLanguageFlag } from "@/lib/languages";
import type { StandaloneUnitInfo } from "@/lib/types";

export default function LearnScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [units, setUnits] = useState<StandaloneUnitInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUnits = useCallback(async () => {
    try {
      const data = await getUnits();
      setUnits(data);
    } catch (error) {
      console.error("Failed to fetch units:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUnits();
    }, [fetchUnits])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUnits();
  };

  const renderUnit = ({ item }: { item: StandaloneUnitInfo }) => {
    const progress =
      item.lessonCount > 0
        ? Math.round((item.completedLessons / item.lessonCount) * 100)
        : 0;

    return (
      <TouchableOpacity
        style={[
          styles.unitCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
        ]}
        onPress={() =>
          router.push({
            pathname: "/unit/[unitId]",
            params: { unitId: item.id },
          })
        }
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.unitIcon,
            { backgroundColor: item.color || Brand.primary + "20" },
          ]}
        >
          <ThemedText style={styles.unitEmoji}>
            {item.icon || "📘"}
          </ThemedText>
        </View>

        <View style={styles.unitContent}>
          <View style={styles.unitHeader}>
            <ThemedText style={styles.unitTitle} numberOfLines={1}>
              {item.title}
            </ThemedText>
            {item.targetLanguage && (
              <ThemedText style={styles.langBadge}>
                {getLanguageFlag(item.targetLanguage)}
              </ThemedText>
            )}
          </View>

          <ThemedText
            themeColor="textSecondary"
            style={styles.unitDescription}
            numberOfLines={2}
          >
            {item.description}
          </ThemedText>

          <View style={styles.progressRow}>
            <View
              style={[
                styles.progressBar,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress}%`,
                    backgroundColor:
                      progress === 100 ? Brand.primary : Brand.secondary,
                  },
                ]}
              />
            </View>
            <ThemedText themeColor="textSecondary" style={styles.progressText}>
              {item.completedLessons}/{item.lessonCount}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View
        style={[
          styles.centerContainer,
          { backgroundColor: theme.background },
        ]}
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
      {units.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyEmoji}>📚</ThemedText>
          <ThemedText type="subtitle" style={styles.emptyTitle}>
            No units yet
          </ThemedText>
          <ThemedText
            themeColor="textSecondary"
            style={styles.emptyDescription}
          >
            Ask the AI in Chat to create a learning unit for you!
          </ThemedText>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push("/(tabs)/chat")}
          >
            <ThemedText style={styles.createButtonText}>
              Go to Chat
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={units}
          renderItem={renderUnit}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Brand.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: Spacing.three, gap: Spacing.three },
  // Unit Card
  unitCard: {
    flexDirection: "row",
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.three,
  },
  unitIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  unitEmoji: { fontSize: 28 },
  unitContent: { flex: 1, gap: Spacing.one },
  unitHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  unitTitle: { flex: 1, fontSize: 16, fontWeight: "700" },
  langBadge: { fontSize: 18 },
  unitDescription: { fontSize: 13, lineHeight: 18 },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { fontSize: 12, fontWeight: "600", minWidth: 36 },
  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.five,
  },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.three },
  emptyTitle: { marginBottom: Spacing.two, textAlign: "center" },
  emptyDescription: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: Spacing.four,
  },
  createButton: {
    backgroundColor: Brand.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: Spacing.four,
  },
  createButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
