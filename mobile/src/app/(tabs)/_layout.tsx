import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { useTheme } from "@/hooks/use-theme";
import { Brand } from "@/constants/theme";

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: Brand.primary,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
        },
        headerStyle: {
          backgroundColor: theme.background,
        },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="💬" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: "Learn",
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="📚" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="words"
        options={{
          title: "Words",
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="📝" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="read"
        options={{
          title: "Read",
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="📖" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="⚙️" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  emoji,
  color,
  size,
}: {
  emoji: string;
  color: string;
  size: number;
}) {
  const React = require("react");
  const { Text } = require("react-native");
  return (
    <Text style={{ fontSize: size - 4, textAlign: "center" }}>{emoji}</Text>
  );
}
