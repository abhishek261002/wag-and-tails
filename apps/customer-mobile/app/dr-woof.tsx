import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@wag/design-tokens';
import { Icon } from '@wag/ui-mobile';
import type { AiChatMessage, Pet } from '@wag/shared-types';
import { wagApi } from '../src/lib/api';
import { goBack } from '../src/lib/nav';

type ChatItem = AiChatMessage & { failed?: boolean; retryText?: string };

const MAX_CHARS = 500;

/**
 * Dr. Woof: one pet-care assistant that knows all of the customer's pets (profile, medical history, vaccinations,
 * care notes, grooming and walks) and can also answer general questions about animals. It only talks about pets
 * and animals; the server enforces that and the safety rules (no diagnoses or doses, emergencies go to a vet).
 */
export default function DrWoofScreen() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const listRef = useRef<FlatList>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    wagApi.pets.list().then(setPets).catch(() => {});
    // Pick the latest conversation back up.
    (async () => {
      try {
        const sessions = await wagApi.ai.drWoofSessions();
        const latest = sessions[0];
        if (latest) {
          const history = await wagApi.ai.getSessionMessages(latest.id);
          setSessionId(latest.id);
          setMessages(history as ChatItem[]);
        }
      } catch {
        // An empty chat is fine if history can't be loaded.
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, []);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim().slice(0, MAX_CHARS);
    // The ref guards against a double tap sending the same message twice before `sending` re-renders.
    if (!text || inFlight.current) return;
    inFlight.current = true;
    setInput('');
    setSending(true);

    const userMsg: ChatItem = {
      id: `tmp_${Date.now()}`,
      sessionId: sessionId ?? '',
      role: 'user',
      content: text,
      refusalReason: null,
      suggestedActions: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev.filter((m) => !m.failed), userMsg]);

    try {
      const res = await wagApi.ai.drWoof(text, sessionId ?? undefined);
      setSessionId(res.sessionId);
      setMessages((prev) => [...prev, res.message]);
    } catch (err: any) {
      const tooFast = err?.statusCode === 429 || /too quickly/i.test(err?.message ?? '');
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sessionId: sessionId ?? '',
          role: 'assistant',
          content: tooFast
            ? 'You are sending messages too quickly. Please wait a few minutes and try again.'
            : "I couldn't reach the server. Check your connection and tap Retry.",
          refusalReason: null,
          suggestedActions: [],
          createdAt: new Date().toISOString(),
          failed: !tooFast,
          retryText: text,
        },
      ]);
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }, [sessionId]);

  const newChat = () => {
    if (!messages.length) return;
    Alert.alert('Start a new chat?', 'Dr. Woof will not remember this conversation in the new one. Your pets\' records stay as they are.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'New chat', onPress: () => { setMessages([]); setSessionId(null); setInput(''); } },
    ]);
  };

  const names = pets.map((p) => p.name);
  const first = names[0] ?? 'my pet';
  const quick = [
    names.length ? `Are ${names.length > 1 ? 'my pets' : first}'s vaccinations up to date?` : 'When should puppies get their first vaccines?',
    names.length ? `What should I feed ${first}?` : 'How often should I groom my dog?',
    'My pet is scratching a lot. What could it be?',
    'What are safe treats for dogs and cats?',
  ];
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;
  const subtitle = names.length ? `Knows ${names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`}` : 'Pet care questions, answered';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => goBack()} accessibilityLabel="Go back" style={styles.iconBtn}>
            <Icon name="back" size={22} color={colors.brandBrown} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.avatar}><Icon name="paw" size={18} color={colors.marigoldDark} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Dr. Woof</Text>
              <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={newChat} accessibilityLabel="New chat" style={styles.iconBtn} disabled={!messages.length}>
            <Icon name="plus" size={20} color={messages.length ? colors.brandBrown : colors.textDisabled} />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            loadingHistory ? (
              <View style={styles.empty}><ActivityIndicator color={colors.brandBrown} /></View>
            ) : (
              <View style={styles.empty}>
                <View style={styles.bigAvatar}><Icon name="paw" size={34} color={colors.marigoldDark} /></View>
                <Text style={styles.emptyTitle}>Hi, I'm Dr. Woof</Text>
                <Text style={styles.emptySub}>
                  Ask me anything about your pets or animals in general: health, food, behaviour, grooming, medicines and more.
                  I'm not a vet, so for anything serious please see one.
                </Text>
                <View style={styles.quickWrap}>
                  {quick.map((q) => (
                    <TouchableOpacity key={q} style={styles.quick} onPress={() => send(q)} accessibilityLabel={q}>
                      <Text style={styles.quickText}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )
          }
          ListFooterComponent={
            sending ? (
              <View style={[styles.bubble, styles.aiBubble, styles.typing]}>
                <ActivityIndicator size="small" color={colors.textMuted} />
                <Text style={styles.typingText}>Dr. Woof is thinking…</Text>
              </View>
            ) : null
          }
          renderItem={({ item: msg }) => (
            <View>
              <View style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble, msg.failed && styles.errorBubble]}>
                <Text style={[styles.bubbleText, msg.role === 'user' ? styles.userText : styles.aiText]} selectable>{msg.content}</Text>
                {msg.failed && !!msg.retryText && (
                  <TouchableOpacity onPress={() => send(msg.retryText!)} style={styles.retryRow} accessibilityLabel="Retry">
                    <Icon name="refresh" size={13} color={colors.error} />
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
              {msg.role === 'assistant' && msg.id === lastAssistantId && !sending && (msg.suggestedActions?.length ?? 0) > 0 && (
                <View style={styles.suggestions}>
                  {msg.suggestedActions.map((s: string) => (
                    <TouchableOpacity key={s} style={styles.chip} onPress={() => send(s)} accessibilityLabel={s}>
                      <Text style={styles.chipText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        />

        <Text style={styles.disclaimer}>Dr. Woof gives general guidance and is not a substitute for a vet.</Text>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ask Dr. Woof…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MAX_CHARS}
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: colors.white },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginHorizontal: spacing[2] },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.marigoldBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter', fontSize: typography.fontSize.base, fontWeight: '800', color: colors.textPrimary },
  headerSub: { fontFamily: 'Inter', fontSize: 11.5, color: colors.textMuted },
  list: { padding: spacing[5], paddingBottom: spacing[4], gap: spacing[3], flexGrow: 1 },
  empty: { alignItems: 'center', paddingTop: spacing[8] },
  bigAvatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.marigoldBg, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: 'Inter', fontSize: typography.fontSize.xl, fontWeight: '800', color: colors.textPrimary, marginTop: spacing[4] },
  emptySub: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted, textAlign: 'center', marginTop: spacing[2], maxWidth: 310, lineHeight: 20 },
  quickWrap: { marginTop: spacing[6], width: '100%', gap: spacing[2] },
  quick: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing[3], borderWidth: 1, borderColor: colors.borderLight },
  quickText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textSecondary },
  bubble: { maxWidth: '86%', borderRadius: radii.xl, padding: spacing[4] },
  userBubble: { backgroundColor: colors.brandBrown, alignSelf: 'flex-end', borderBottomRightRadius: radii.xs },
  aiBubble: { backgroundColor: colors.white, alignSelf: 'flex-start', borderBottomLeftRadius: radii.xs, borderWidth: 1, borderColor: colors.borderLight },
  errorBubble: { backgroundColor: colors.errorLight, borderColor: colors.error },
  typing: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[3] },
  typingText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.textMuted },
  bubbleText: { fontFamily: 'Inter', fontSize: typography.fontSize.base, lineHeight: 22 },
  userText: { color: colors.white },
  aiText: { color: colors.textPrimary },
  retryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing[2] },
  retryText: { fontFamily: 'Inter', fontSize: typography.fontSize.xs, fontWeight: '700', color: colors.error },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2], maxWidth: '92%' },
  chip: { backgroundColor: colors.marigoldBg, borderRadius: radii.xl, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  chipText: { fontFamily: 'Inter', fontSize: typography.fontSize.sm, color: colors.marigoldDark, fontWeight: '600' },
  disclaimer: { fontFamily: 'Inter', fontSize: 11, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing[1] },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[3], padding: spacing[4], paddingTop: spacing[2], backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.borderLight },
  textInput: { flex: 1, borderWidth: 1.5, borderColor: colors.borderLight, borderRadius: radii.xl, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontFamily: 'Inter', fontSize: typography.fontSize.base, color: colors.textPrimary, maxHeight: 110 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandBrown, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
});
