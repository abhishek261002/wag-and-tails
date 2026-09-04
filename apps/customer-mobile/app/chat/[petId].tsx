import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import type { AiChatMessage, Pet } from '@wag/shared-types';

export default function PetChatScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const [pet, setPet] = useState<Pet | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!petId) return;
    wagApi.pets.get(petId).then((p) => setPet(p as any)).catch(() => {});
  }, [petId]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !petId) return;
    setInput('');
    setSending(true);

    // Optimistic user message
    const tempUserMsg: AiChatMessage = {
      id: `tmp_${Date.now()}`,
      sessionId: sessionId ?? '',
      role: 'user',
      content: text,
      refusalReason: null,
      suggestedActions: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await wagApi.ai.chat({ petId, message: text, sessionId: sessionId ?? undefined });
      setSessionId(res.sessionId);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        tempUserMsg,
        res.message,
      ]);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setSending(false);
    }
  };

  const QUICK_PROMPTS = [
    `What does ${pet?.name ?? 'my pet'} like to eat?`,
    `Is ${pet?.name ?? 'my pet'} due for grooming?`,
    'Any health tips today?',
    'What should I pack for a walk?',
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.petEmoji}>🐾</Text>
            <View>
              <Text style={styles.headerTitle}>{pet?.name ?? 'Pet Chat'}</Text>
              <Text style={styles.headerSub}>AI Pet Persona · Powered by Wag & Tails</Text>
            </View>
          </View>
          <View style={{ width: 32 }} />
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={{ fontSize: 48 }}>🐶</Text>
              <Text style={styles.emptyChatTitle}>Hi! I'm {pet?.name ?? 'your pet'}</Text>
              <Text style={styles.emptyChatSub}>
                Ask me anything about my care, health, or what I've been up to!
              </Text>
              <View style={styles.quickPrompts}>
                {QUICK_PROMPTS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={styles.quickPrompt}
                    onPress={() => { setInput(p); }}
                    accessibilityLabel={p}
                  >
                    <Text style={styles.quickPromptText}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          renderItem={({ item: msg }) => (
            <View style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              <Text style={[styles.bubbleText, msg.role === 'user' ? styles.userText : styles.aiText]}>
                {msg.content}
              </Text>
              {msg.refusalReason && (
                <Text style={styles.refusalNote}>🔒 {msg.refusalReason}</Text>
              )}
            </View>
          )}
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder={`Ask ${pet?.name ?? 'your pet'} something...`}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            accessibilityLabel="Message input"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
            accessibilityLabel="Send message"
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.sendIcon}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[5], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: colors.white },
  backText: { fontSize: 22, color: colors.brandBrown, fontWeight: '700' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginLeft: spacing[3] },
  petEmoji: { fontSize: 32 },
  headerTitle: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '700', color: colors.textPrimary },
  headerSub: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted },
  messageList: { padding: spacing[5], paddingBottom: spacing[4], gap: spacing[3] },
  emptyChat: { alignItems: 'center', paddingTop: spacing[10] },
  emptyChatTitle: { fontFamily: 'Inter', fontSize: typography.fontSize.xl, fontWeight: '800', color: colors.textPrimary, marginTop: spacing[4] },
  emptyChatSub: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted, textAlign: 'center', marginTop: spacing[2], maxWidth: 280 },
  quickPrompts: { marginTop: spacing[6], width: '100%', gap: spacing[2] },
  quickPrompt: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing[3], borderWidth: 1, borderColor: colors.borderLight },
  quickPromptText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textSecondary },
  bubble: { maxWidth: '85%', borderRadius: radii.xl, padding: spacing[4] },
  userBubble: { backgroundColor: colors.brandBrown, alignSelf: 'flex-end', borderBottomRightRadius: radii.xs },
  aiBubble: { backgroundColor: colors.white, alignSelf: 'flex-start', borderBottomLeftRadius: radii.xs, borderWidth: 1, borderColor: colors.borderLight },
  bubbleText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, lineHeight: 22 },
  userText: { color: colors.white },
  aiText: { color: colors.textPrimary },
  refusalNote: { fontFamily: 'Inter', fontSize: typography.fontSize.xs, color: colors.textMuted, marginTop: spacing[2] },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[3], padding: spacing[4], backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.borderLight },
  textInput: { flex: 1, borderWidth: 1.5, borderColor: colors.borderLight, borderRadius: radii.xl, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textPrimary, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandBrown, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: colors.white, fontSize: 20, fontWeight: '700' },
});
