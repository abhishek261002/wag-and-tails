import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii } from '@wag/design-tokens';
import { wagApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';

export default function PartnerMessagingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { userId } = useAuthStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const conv = await wagApi.client.get<any>(`/messaging/booking/${bookingId}`);
        setConversationId(conv.id);
        const msgs = await wagApi.client.get<any[]>(`/messaging/${conv.id}/messages`);
        setMessages(msgs);
      } catch {}
    };
    load();

    const poll = setInterval(async () => {
      if (!conversationId) return;
      try {
        const msgs = await wagApi.client.get<any[]>(`/messaging/${conversationId}/messages`);
        setMessages(msgs);
      } catch {}
    }, 4000);

    return () => clearInterval(poll);
  }, [bookingId, conversationId]);

  const send = async () => {
    if (!text.trim() || !conversationId) return;
    setSending(true);
    const content = text.trim();
    setText('');
    try {
      await wagApi.client.post(`/messaging/${conversationId}/messages`, { content });
      const msgs = await wagApi.client.get<any[]>(`/messaging/${conversationId}/messages`);
      setMessages(msgs);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch { setText(content); } finally { setSending(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Customer Chat</Text>
        <View style={{ width: 50 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: msg }) => {
            const isMe = msg.senderId === userId;
            return (
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                {!isMe && <Text style={styles.senderName}>{msg.senderName}</Text>}
                <Text style={[styles.msgText, isMe ? styles.msgTextMe : {}]}>{msg.content}</Text>
                <Text style={[styles.time, isMe ? styles.timeMe : {}]}>
                  {new Date(msg.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          }}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            accessibilityLabel="Message input"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!text.trim() || sending}
            accessibilityLabel="Send message"
          >
            <Text style={{ fontSize: 20 }}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: colors.white },
  back: { fontFamily: 'Inter', fontSize: 15, color: colors.brandBrown, fontWeight: '600' },
  title: { fontFamily: 'Inter', fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  list: { padding: spacing[4], gap: spacing[2] },
  bubble: { maxWidth: '80%', borderRadius: radii.xl, padding: spacing[3] },
  bubbleMe: { backgroundColor: colors.brandBrown, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: colors.white, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.borderLight },
  senderName: { fontFamily: 'Inter', fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 3 },
  msgText: { fontFamily: 'Inter', fontSize: 15, color: colors.textPrimary },
  msgTextMe: { color: colors.white },
  time: { fontFamily: 'Inter', fontSize: 10, color: colors.textMuted, marginTop: 4, textAlign: 'right' },
  timeMe: { color: 'rgba(255,255,255,0.6)' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], padding: spacing[3], borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.white },
  input: { flex: 1, backgroundColor: colors.canvas, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: spacing[4], paddingVertical: spacing[2], fontFamily: 'Inter', fontSize: 15, color: colors.textPrimary, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandBrown, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: colors.borderMedium },
});
