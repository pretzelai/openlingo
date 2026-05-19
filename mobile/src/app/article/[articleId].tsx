import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "@/components/themed-text";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";
import { getArticle } from "@/lib/api";
import { getLanguageFlag } from "@/lib/languages";
import type { ArticleDetail } from "@/lib/types";

type ViewMode = "translated" | "original" | "side-by-side";

export default function ArticleDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("translated");

  useEffect(() => {
    (async () => {
      try {
        const data = await getArticle(articleId);
        setArticle(data);
      } catch (error) {
        console.error("Failed to fetch article:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [articleId]);

  if (loading) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: theme.background }]}
      >
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  if (!article) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: theme.background }]}
      >
        <ThemedText>Article not found</ThemedText>
      </View>
    );
  }

  const modes: { key: ViewMode; label: string }[] = [
    { key: "translated", label: `${getLanguageFlag(article.targetLanguage)} Translated` },
    { key: "original", label: `${getLanguageFlag(article.sourceLanguage)} Original` },
    { key: "side-by-side", label: "Side by Side" },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: article.title || "Article",
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
        }}
      />
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        {/* View Mode Toggle */}
        <View
          style={[
            styles.modeToggle,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          {modes.map((mode) => (
            <TouchableOpacity
              key={mode.key}
              style={[
                styles.modeButton,
                viewMode === mode.key && {
                  backgroundColor: theme.background,
                },
              ]}
              onPress={() => setViewMode(mode.key)}
            >
              <ThemedText
                style={[
                  styles.modeButtonText,
                  viewMode === mode.key && {
                    color: Brand.primary,
                    fontWeight: "700",
                  },
                ]}
              >
                {mode.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.articleContent}>
          {/* Meta */}
          <View style={styles.meta}>
            {article.cefrLevel && (
              <View
                style={[
                  styles.cefrBadge,
                  { backgroundColor: Brand.secondary + "20" },
                ]}
              >
                <ThemedText
                  style={[styles.cefrText, { color: Brand.secondary }]}
                >
                  {article.cefrLevel}
                </ThemedText>
              </View>
            )}
            {article.wordCount && (
              <ThemedText themeColor="textTertiary" style={styles.metaText}>
                {article.wordCount} words
              </ThemedText>
            )}
          </View>

          {/* Article Body */}
          {viewMode === "translated" && article.translatedContent && (
            <ThemedText style={styles.articleText}>
              {article.translatedContent}
            </ThemedText>
          )}

          {viewMode === "original" && article.originalContent && (
            <ThemedText style={styles.articleText}>
              {article.originalContent}
            </ThemedText>
          )}

          {viewMode === "side-by-side" && (
            <View style={styles.sideBySide}>
              {article.translatedContent && (
                <View style={styles.sideBySideColumn}>
                  <ThemedText style={styles.columnLabel}>Translated</ThemedText>
                  <ThemedText style={styles.articleText}>
                    {article.translatedContent}
                  </ThemedText>
                </View>
              )}
              {article.originalContent && (
                <View style={styles.sideBySideColumn}>
                  <ThemedText style={styles.columnLabel}>Original</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.articleText}>
                    {article.originalContent}
                  </ThemedText>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  // Mode Toggle
  modeToggle: {
    flexDirection: "row",
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    borderRadius: BorderRadius.md,
    padding: 3,
  },
  modeButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  modeButtonText: { fontSize: 12, fontWeight: "500" },
  // Content
  articleContent: {
    padding: Spacing.four,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  cefrBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  cefrText: { fontSize: 12, fontWeight: "700" },
  metaText: { fontSize: 12 },
  articleText: { fontSize: 17, lineHeight: 28 },
  sideBySide: { gap: Spacing.four },
  sideBySideColumn: { gap: Spacing.two },
  columnLabel: { fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
});
