import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "@/components/themed-text";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";
import { getArticles, deleteArticle } from "@/lib/api";
import { getLanguageFlag } from "@/lib/languages";
import type { Article } from "@/lib/types";

export default function ReadScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchArticles = useCallback(async () => {
    try {
      const data = await getArticles();
      setArticles(data);
    } catch (error) {
      console.error("Failed to fetch articles:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchArticles();
    }, [fetchArticles])
  );

  const handleDelete = (id: string, title: string) => {
    Alert.alert("Delete Article", `Delete "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteArticle(id);
            setArticles((prev) => prev.filter((a) => a.id !== id));
          } catch {
            Alert.alert("Error", "Failed to delete article");
          }
        },
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return Brand.primary;
      case "translating":
        return Brand.warning;
      case "failed":
        return Brand.danger;
      default:
        return theme.textSecondary;
    }
  };

  const renderArticle = ({ item }: { item: Article }) => (
    <TouchableOpacity
      style={[
        styles.articleCard,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
      onPress={() => {
        if (item.status === "completed") {
          router.push({
            pathname: "/article/[articleId]",
            params: { articleId: item.id },
          });
        }
      }}
      onLongPress={() => handleDelete(item.id, item.title)}
      disabled={item.status !== "completed"}
      activeOpacity={0.7}
    >
      <View style={styles.articleHeader}>
        <ThemedText style={styles.articleTitle} numberOfLines={2}>
          {item.title || "Untitled"}
        </ThemedText>
        <View style={styles.langFlags}>
          <ThemedText>{getLanguageFlag(item.sourceLanguage)}</ThemedText>
          <ThemedText themeColor="textTertiary">→</ThemedText>
          <ThemedText>{getLanguageFlag(item.targetLanguage)}</ThemedText>
        </View>
      </View>

      <View style={styles.articleMeta}>
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

        {item.wordCount && (
          <ThemedText themeColor="textTertiary" style={styles.wordCount}>
            {item.wordCount} words
          </ThemedText>
        )}

        {item.status === "translating" && item.translationProgress != null && (
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
                  width: `${item.translationProgress}%`,
                  backgroundColor: Brand.warning,
                },
              ]}
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
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
      {articles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyEmoji}>📖</ThemedText>
          <ThemedText type="subtitle" style={styles.emptyTitle}>
            No articles yet
          </ThemedText>
          <ThemedText
            themeColor="textSecondary"
            style={styles.emptyDescription}
          >
            Ask the AI to translate an article for you in the Chat tab!
          </ThemedText>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push("/(tabs)/chat")}
          >
            <ThemedText style={styles.createButtonText}>Go to Chat</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={articles}
          renderItem={renderArticle}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchArticles();
              }}
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
  // Article Card
  articleCard: {
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.two,
  },
  articleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.two,
  },
  articleTitle: { flex: 1, fontSize: 16, fontWeight: "700", lineHeight: 22 },
  langFlags: { flexDirection: "row", gap: 4, alignItems: "center" },
  articleMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  statusBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  wordCount: { fontSize: 12 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.five,
  },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.three },
  emptyTitle: { marginBottom: Spacing.two, textAlign: "center" },
  emptyDescription: { fontSize: 15, textAlign: "center", marginBottom: Spacing.four },
  createButton: {
    backgroundColor: Brand.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: Spacing.four,
  },
  createButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
