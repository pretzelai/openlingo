import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "@/components/themed-text";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";
import { getUnit } from "@/lib/api";
import type { UnitWithContent, UnitLesson } from "@/lib/types";

export default function UnitDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const [unit, setUnit] = useState<UnitWithContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getUnit(unitId);
        setUnit(data);
      } catch (error) {
        console.error("Failed to fetch unit:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [unitId]);

  if (loading) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: theme.background }]}
      >
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  if (!unit) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: theme.background }]}
      >
        <ThemedText>Unit not found</ThemedText>
      </View>
    );
  }

  const renderLesson = ({
    item,
    index,
  }: {
    item: UnitLesson;
    index: number;
  }) => {
    const lessonNumber = index + 1;
    const exerciseCount = item.exercises.length;

    return (
      <TouchableOpacity
        style={[
          styles.lessonCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
        onPress={() =>
          router.push({
            pathname: "/lesson/[unitId]/[lessonIndex]",
            params: { unitId, lessonIndex: index.toString() },
          })
        }
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.lessonNumber,
            { backgroundColor: Brand.primary + "15" },
          ]}
        >
          <ThemedText style={[styles.lessonNumberText, { color: Brand.primary }]}>
            {lessonNumber}
          </ThemedText>
        </View>

        <View style={styles.lessonContent}>
          <ThemedText style={styles.lessonTitle}>{item.title}</ThemedText>
          {item.description && (
            <ThemedText
              themeColor="textSecondary"
              style={styles.lessonDescription}
              numberOfLines={2}
            >
              {item.description}
            </ThemedText>
          )}
          <ThemedText themeColor="textTertiary" style={styles.exerciseCount}>
            {exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""}
          </ThemedText>
        </View>

        <ThemedText themeColor="textTertiary" style={styles.arrow}>
          →
        </ThemedText>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: unit.title,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
        }}
      />
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        {/* Unit Header */}
        <View style={styles.unitHeader}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: unit.color || Brand.primary + "20" },
            ]}
          >
            <ThemedText style={styles.unitIcon}>{unit.icon || "📘"}</ThemedText>
          </View>
          <ThemedText type="subtitle" style={styles.unitTitle}>
            {unit.title}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.unitDescription}>
            {unit.description}
          </ThemedText>
          <ThemedText themeColor="textTertiary" style={styles.lessonCountBadge}>
            {unit.lessons.length} lesson{unit.lessons.length !== 1 ? "s" : ""}
          </ThemedText>
        </View>

        {/* Lessons List */}
        <FlatList
          data={unit.lessons}
          renderItem={renderLesson}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  // Unit Header
  unitHeader: {
    alignItems: "center",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.two,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  unitIcon: { fontSize: 36 },
  unitTitle: { textAlign: "center" },
  unitDescription: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  lessonCountBadge: { fontSize: 13, fontWeight: "600" },
  // Lessons
  listContent: { padding: Spacing.three, gap: Spacing.two },
  lessonCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.three,
  },
  lessonNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  lessonNumberText: { fontSize: 18, fontWeight: "700" },
  lessonContent: { flex: 1 },
  lessonTitle: { fontSize: 16, fontWeight: "600" },
  lessonDescription: { fontSize: 13, marginTop: 2 },
  exerciseCount: { fontSize: 12, marginTop: 4 },
  arrow: { fontSize: 20 },
});
