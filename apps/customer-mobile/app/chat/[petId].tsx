import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { Icon } from '@wag/ui-mobile';
import { wagApi } from '../../src/lib/api';
import type { AiChatMessage, Pet } from '@wag/shared-types';

type ChatItem = AiChatMessage & { failed?: boolean };

export default function PetChatScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const [pet, setPet] = useState<Pet | null>(null);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!petId) return;
    wagApi.pets.get(petId).then((p) => setPet(p as any)).catch(() => {});

    // Pick the conversation back up where it was left off.
    (async () => {
      try {
        const sessions = await wagApi.ai.getSessions(petId);
        const latest = sessions[0];
        if (latest) {
          const history = await wagApi.ai.getSessionMessages(latest.id);
          setSessionId(latest.id);
          setMessages(history as ChatItem[]);
        }
      } catch {
        // Empty state is fine if history can't be loaded.
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [petId]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || !petId || sending) return;
    setInput('');
    setSending(true);

    const tempId = `tmp_${Date.now()}`;
    const userMsg: ChatItem = {
      id: tempId,
      sessionId: sessionId ?? '',
      role: 'user',
      content: text,
      refusalReason: null,
      suggestedActions: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev.filter((m) => !m.failed), userMsg]);

    try {
      const res = await wagApi.ai.chat({ petId, message: text, sessionId: sessionId ?? undefined });
      setSessionId(res.sessionId);
      setMessages((prev) => [...prev, res.message]);
    } catch (err: any) {
      const tooFast = err?.response?.status === 429 || /too quickly/i.test(err?.message ?? '');
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sessionId: sessionId ?? '',
          role: 'assistant',
          content: tooFast
            ? 'You are sending messages too quickly. Please wait a few minutes and try again.'
            : "I couldn't reach the server. Check your connection and tap retry.",
          refusalReason: null,
          suggestedActions: [],
          createdAt: new Date().toISOString(),
          failed: true,
        },
      ]);
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const name = pet?.name ?? 'my pet';
  const QUICK_PROMPTS = [
    `What should I know about ${name}'s care notes?`,
    `Is ${name} due for grooming?`,
    `How have ${name}'s walks been?`,
    `Are ${name}'s vaccinations up to date?`,
  ];

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back" style={styles.backBtn}>
            <Icon name="back" size={22} color={colors.brandBrown} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.petIconBox}>
              <Icon name="paw" size={17} color={colors.marigoldDark} />
            </View>
            <View>
              <Text style={styles.headerTitle}>{pet?.name ?? 'Pet chat'}</Text>
              <Text style={styles.headerSub}>Knows my profile, notes and history</Text>
            </View>
          </View>
          <View style={{ width: 32 }} />
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            loadingHistory ? (
              <View style={styles.emptyChat}>
                <ActivityIndicator color={colors.brandBrown} />
              </View>
            ) : (
              <View style={styles.emptyChat}>
                <Icon name="paw" size={44} color={colors.textDisabled} />
                <Text style={styles.emptyChatTitle}>Hi, I'm {pet?.name ?? 'your pet'}</Text>
                <Text style={styles.emptyChatSub}>
                  Ask me about my care, health, food, grooming or walks. I only talk about me.
                </Text>
                <View style={styles.quickPrompts}>
                  {QUICK_PROMPTS.map((p) => (
                    <TouchableOpacity key={p} style={styles.quickPrompt} onPress={() => send(p)} accessibilityLabel={p}>
                      <Text style={styles.quickPromptText}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )
          }
          ListFooterComponent={
            sending ? (
              <View style={[styles.bubble, styles.aiBubble, styles.typingBubble]}>
                <ActivityIndicator size="small" color={colors.textMuted} />
                <Text style={styles.typingText}>{pet?.name ?? 'Your pet'} is thinking…</Text>
              </View>
            ) : null
          }
          renderItem={({ item: msg }) => (
            <View>
              <View style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble, msg.failed && styles.errorBubble]}>
                <Text style={[styles.bubbleText, msg.role === 'user' ? styles.userText : styles.aiText]}>{msg.content}</Text>
                {msg.failed && (
                  <TouchableOpacity onPress={() => send(input)} style={styles.retryRow} accessibilityLabel="Retry">
                    <Icon name="refresh" size={13} color={colors.error} />
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
              {msg.role === 'assistant' && msg.id === lastAssistantId && !sending && msg.suggestedActions?.length > 0 && (
                <View style={styles.suggestions}>
                  {msg.suggestedActions.map((s: string) => (
                    <TouchableOpacity key={s} style={styles.suggestionChip} onPress={() => send(s)} accessibilityLabel={s}>
                      <Text style={styles.suggestionText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        />

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
            onSubmitEditing={() => send(input)}
            accessibilityLabel="Message input"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || sending}
            accessibilityLabel="Send message"
          >
            {sending ? <ActivityIndicator size="small" color={colors.white} /> : <Icon name="send" size={19} color={colors.white} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[5], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: colors.white },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginLeft: spacing[3] },
  petIconBox: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.marigoldBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '700', color: colors.textPrimary },
  headerSub: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted },
  messageList: { padding: spacing[5], paddingBottom: spacing[4], gap: spacing[3], flexGrow: 1 },
  emptyChat: { alignItems: 'center', paddingTop: spacing[10] },
  emptyChatTitle: { fontFamily: 'Inter', fontSize: typography.fontSize.xl, fontWeight: '800', color: colors.textPrimary, marginTop: spacing[4] },
  emptyChatSub: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted, textAlign: 'center', marginTop: spacing[2], maxWidth: 280 },
  quickPrompts: { marginTop: spacing[6], width: '100%', gap: spacing[2] },
  quickPrompt: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing[3], borderWidth: 1, borderColor: colors.borderLight },
  quickPromptText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textSecondary },
  bubble: { maxWidth: '85%', borderRadius: radii.xl, padding: spacing[4] },
  userBubble: { backgroundColor: colors.brandBrown, alignSelf: 'flex-end', borderBottomRightRadius: radii.xs },
  aiBubble: { backgroundColor: colors.white, alignSelf: 'flex-start', borderBottomLeftRadius: radii.xs, borderWidth: 1, borderColor: colors.borderLight },
  errorBubble: { backgroundColor: colors.errorLight, borderColor: colors.error },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[3] },
  typingText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted },
  bubbleText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, lineHeight: 22 },
  userText: { color: colors.white },
  aiText: { color: colors.textPrimary },
  retryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing[2] },
  retryText: { fontFamily: 'Inter', fontSize: typography.fontSize.xs, fontWeight: '700', color: colors.error },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2], maxWidth: '92%' },
  suggestionChip: { backgroundColor: colors.marigoldBg, borderRadius: radii.xl, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  suggestionText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.marigoldDark, fontWeight: '600' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[3], padding: spacing[4], backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.borderLight },
  textInput: { flex: 1, borderWidth: 1.5, borderColor: colors.borderLight, borderRadius: radii.xl, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textPrimary, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandBrown, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
});
