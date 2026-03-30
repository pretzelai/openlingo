import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "@/components/themed-text";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";
import { getUserStats, getApiUrl } from "@/lib/api";
import {
  getLanguageFlag,
  getLanguageName,
  supportedLanguages,
  nativeLanguages,
} from "@/lib/languages";
import type { UserStats } from "@/lib/types";

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [serverUrl, setServerUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [statsData, url] = await Promise.all([
            getUserStats().catch(() => null),
            getApiUrl(),
          ]);
          setStats(statsData);
          setServerUrl(url);
        } catch {
          // Ignore
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/");
        },
      },
    ]);
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

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Section */}
        <View style={[styles.section, { borderColor: theme.border }]}>
          <View style={styles.profileHeader}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: Brand.primary + "20" },
              ]}
            >
              <ThemedText style={styles.avatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || "?"}
              </ThemedText>
            </View>
            <View style={styles.profileInfo}>
              <ThemedText style={styles.profileName}>
                {user?.name || "User"}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.profileEmail}>
                {user?.email || ""}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Stats Section */}
        {stats && (
          <View style={[styles.section, { borderColor: theme.border }]}>
            <ThemedText style={styles.sectionTitle}>Statistics</ThemedText>
            <View style={styles.statsGrid}>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                <ThemedText style={styles.statEmoji}>🔥</ThemedText>
                <ThemedText style={styles.statValue}>
                  {stats.currentStreak}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                  Day streak
                </ThemedText>
              </View>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                <ThemedText style={styles.statEmoji}>🏆</ThemedText>
                <ThemedText style={styles.statValue}>
                  {stats.longestStreak}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                  Best streak
                </ThemedText>
              </View>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                <ThemedText style={styles.statEmoji}>✅</ThemedText>
                <ThemedText style={styles.statValue}>
                  {stats.totalLessonsCompleted}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                  Lessons done
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* Server Info */}
        <View style={[styles.section, { borderColor: theme.border }]}>
          <ThemedText style={styles.sectionTitle}>Server</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.serverUrl}>
            {serverUrl || "Not configured"}
          </ThemedText>
          <TouchableOpacity
            style={[styles.outlineButton, { borderColor: theme.border }]}
            onPress={() => router.push("/(auth)/server-config")}
          >
            <ThemedText style={styles.outlineButtonText}>
              Change Server
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={[
            styles.signOutButton,
            { backgroundColor: Brand.danger + "10" },
          ]}
          onPress={handleSignOut}
        >
          <ThemedText style={[styles.signOutText, { color: Brand.danger }]}>
            Sign Out
          </ThemedText>
        </TouchableOpacity>

        {/* App Info */}
        <View style={styles.appInfo}>
          <ThemedText themeColor="textTertiary" style={styles.appInfoText}>
            OpenLingo Mobile v1.0.0
          </ThemedText>
          <ThemedText themeColor="textTertiary" style={styles.appInfoText}>
            github.com/openlingo
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: Spacing.three, gap: Spacing.three },
  // Section
  section: {
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: Spacing.three },
  // Profile
  profileHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 24, fontWeight: "700", color: Brand.primary },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: "700" },
  profileEmail: { fontSize: 14, marginTop: 2 },
  // Stats
  statsGrid: { flexDirection: "row", gap: Spacing.two },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    gap: Spacing.one,
  },
  statEmoji: { fontSize: 24 },
  statValue: { fontSize: 24, fontWeight: "700" },
  statLabel: { fontSize: 11 },
  // Server
  serverUrl: { fontSize: 14, marginBottom: Spacing.two },
  outlineButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  outlineButtonText: { fontSize: 14, fontWeight: "600" },
  // Sign Out
  signOutButton: {
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  signOutText: { fontSize: 16, fontWeight: "700" },
  // App Info
  appInfo: { alignItems: "center", gap: Spacing.one, paddingVertical: Spacing.three },
  appInfoText: { fontSize: 12 },
});
