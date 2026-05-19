import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "@/components/themed-text";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";
import { streamChat } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const GREETING_ACTIONS = [
  { emoji: "📚", label: "Create a lesson", prompt: "Create a beginner lesson for me" },
  { emoji: "💬", label: "Practice conversation", prompt: "Let's practice a conversation" },
  { emoji: "📝", label: "Vocabulary quiz", prompt: "Give me a vocabulary quiz" },
  { emoji: "📖", label: "Read an article", prompt: "Find me an interesting article to read" },
  { emoji: "🔤", label: "Grammar help", prompt: "Help me with grammar" },
];

export default function ChatScreen() {
  const theme = useTheme();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMessage: DisplayMessage = {
        id: Date.now().toString(),
        role: "user",
        content: text.trim(),
      };

      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput("");
      setIsStreaming(true);

      const assistantMessage: DisplayMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
      };
      setMessages([...newMessages, assistantMessage]);

      try {
        const chatMessages = newMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await streamChat(chatMessages, "auto");
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          // Parse SSE data - Vercel AI SDK format
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("0:")) {
              // Text delta
              try {
                const text = JSON.parse(line.slice(2));
                fullContent += text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: fullContent,
                  };
                  return updated;
                });
              } catch {
                // Skip malformed chunks
              }
            }
          }
        }
      } catch (error: any) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: "Sorry, I encountered an error. Please try again.",
          };
          return updated;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, isStreaming]
  );

  const renderMessage = ({ item }: { item: DisplayMessage }) => (
    <View
      style={[
        styles.messageBubble,
        item.role === "user"
          ? [styles.userBubble, { backgroundColor: Brand.primary }]
          : [styles.assistantBubble, { backgroundColor: theme.backgroundElement }],
      ]}
    >
      <ThemedText
        style={[
          styles.messageText,
          item.role === "user"
            ? { color: "#FFFFFF" }
            : { color: theme.text },
        ]}
      >
        {item.content || (isStreaming ? "..." : "")}
      </ThemedText>
    </View>
  );

  if (messages.length === 0) {
    return (
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.container}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <View style={styles.greetingContainer}>
            <ThemedText style={styles.greetingEmoji}>🌍</ThemedText>
            <ThemedText type="subtitle" style={styles.greetingTitle}>
              How can I help you learn?
            </ThemedText>
            <ThemedText
              themeColor="textSecondary"
              style={styles.greetingSubtitle}
            >
              Choose an action or type a message
            </ThemedText>

            <View style={styles.actionsGrid}>
              {GREETING_ACTIONS.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  style={[
                    styles.actionCard,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  ]}
                  onPress={() => sendMessage(action.prompt)}
                >
                  <ThemedText style={styles.actionEmoji}>
                    {action.emoji}
                  </ThemedText>
                  <ThemedText style={styles.actionLabel}>
                    {action.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View
            style={[styles.inputContainer, { borderTopColor: theme.border }]}
          >
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.backgroundElement,
                  color: theme.text,
                },
              ]}
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              placeholderTextColor={theme.textTertiary}
              multiline
              maxLength={4000}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor: input.trim() ? Brand.primary : theme.backgroundSelected,
                },
              ]}
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || isStreaming}
            >
              <ThemedText style={styles.sendIcon}>↑</ThemedText>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {isStreaming && (
          <View style={styles.streamingIndicator}>
            <ActivityIndicator size="small" color={Brand.primary} />
            <ThemedText themeColor="textSecondary" style={styles.streamingText}>
              Thinking...
            </ThemedText>
          </View>
        )}

        <View
          style={[styles.inputContainer, { borderTopColor: theme.border }]}
        >
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.backgroundElement,
                color: theme.text,
              },
            ]}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor={theme.textTertiary}
            multiline
            maxLength={4000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor: input.trim() ? Brand.primary : theme.backgroundSelected,
              },
            ]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
          >
            <ThemedText style={styles.sendIcon}>↑</ThemedText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Greeting
  greetingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.four,
  },
  greetingEmoji: { fontSize: 48, marginBottom: Spacing.three },
  greetingTitle: { textAlign: "center", marginBottom: Spacing.two },
  greetingSubtitle: { fontSize: 15, textAlign: "center", marginBottom: Spacing.four },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.two,
    width: "100%",
  },
  actionCard: {
    width: "47%",
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    gap: Spacing.two,
  },
  actionEmoji: { fontSize: 24 },
  actionLabel: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  // Messages
  messagesList: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  messageBubble: {
    maxWidth: "85%",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.two,
  },
  userBubble: {
    alignSelf: "flex-end",
    borderBottomRightRadius: Spacing.one,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: Spacing.one,
  },
  messageText: { fontSize: 15, lineHeight: 22 },
  // Streaming
  streamingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  streamingText: { fontSize: 13 },
  // Input
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    gap: Spacing.two,
  },
  textInput: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.select({ ios: 10, android: 8 }),
    fontSize: 15,
    maxHeight: 120,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  sendIcon: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
});
