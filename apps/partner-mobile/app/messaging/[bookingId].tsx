import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii } from '@wag/design-tokens';
import { Icon } from '@wag/ui-mobile';
import { wagApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';
import { goBack } from '../../src/lib/nav';

export default function PartnerMessagingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { userId } = useAuthStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const refreshMessages = useCallback(async (convId: string) => {
    try {
      const msgs = await wagApi.messaging.getMessages(convId);
      setMessages(msgs as any[]);
    } catch {}
  }, []);

  // Get-or-create conversation, join the booking's realtime room, and keep
  // a 4s poll running as a fallback in case the socket drops — same
  // primary-socket/fallback-poll pattern used by the live tracking screen.
  useEffect(() => {
    if (!bookingId) return;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let convId: string | null = null;

    wagApi.realtime.connect();
    wagApi.realtime.joinBooking(bookingId);

    const offMessage = wagApi.realtime.on('message:sent', (payload: any) => {
      if (payload.bookingId !== bookingId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.messageId)) return prev;
        return [
          { id: payload.messageId, conversationId: payload.conversationId, senderId: payload.senderId, senderName: payload.senderName, senderRole: payload.senderRole, content: payload.content, attachmentUrl: payload.attachmentUrl, attachmentType: payload.attachmentType, sentAt: payload.sentAt },
          ...prev,
        ];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });

    wagApi.messaging.getOrCreateConversation(bookingId)
      .then((conv: any) => {
        convId = conv.id;
        setConversationId(conv.id);
        refreshMessages(conv.id);
        pollTimer = setInterval(() => refreshMessages(conv.id), 4000);
      })
      .catch(() => {});

    return () => {
      if (pollTimer) clearInterval(pollTimer);
      offMessage();
      wagApi.realtime.disconnect();
    };
  }, [bookingId, refreshMessages]);

  const send = async () => {
    if (!text.trim() || !conversationId) return;
    setSending(true);
    const content = text.trim();
    setText('');
    try {
      await wagApi.messaging.sendMessage({ conversationId, content });
      await refreshMessages(conversationId);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const sendPhoto = async () => {
    if (!conversationId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to share a picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setSending(true);
    try {
      const { url } = await wagApi.messaging.uploadAttachment(conversationId, {
        uri: asset.uri,
        name: asset.fileName ?? 'photo.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      await wagApi.messaging.sendMessage({
        conversationId,
        content: '📷 Photo',
        attachmentUrl: url,
        attachmentType: 'image',
      });
      await refreshMessages(conversationId);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      Alert.alert('Error', 'Could not send photo');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => goBack()} accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Customer Chat</Text>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
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
                {msg.attachmentType === 'image' && msg.attachmentUrl ? (
                  <Image source={{ uri: msg.attachmentUrl }} style={styles.attachmentImage} />
                ) : (
                  <Text style={[styles.msgText, isMe ? styles.msgTextMe : {}]}>{msg.content}</Text>
                )}
                <Text style={[styles.time, isMe ? styles.timeMe : {}]}>
                  {new Date(msg.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="chat" size={32} color={colors.textDisabled} />
              <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
            </View>
          }
        />

        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={sendPhoto}
            disabled={sending || !conversationId}
            accessibilityLabel="Attach photo"
          >
            <Icon name="cam" size={20} color={colors.textMuted} />
          </TouchableOpacity>
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
            <Icon name="send" size={18} color={colors.white} />
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
  attachmentImage: { width: 200, height: 200, borderRadius: radii.lg },
  time: { fontFamily: 'Inter', fontSize: 10, color: colors.textMuted, marginTop: 4, textAlign: 'right' },
  timeMe: { color: 'rgba(255,255,255,0.6)' },
  empty: { alignItems: 'center', paddingTop: spacing[16] },
  emptyText: { fontFamily: 'Inter', fontSize: 14, color: colors.textMuted, marginTop: spacing[2] },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], padding: spacing[3], borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.white },
  attachBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, backgroundColor: colors.canvas, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: spacing[4], paddingVertical: spacing[2], fontFamily: 'Inter', fontSize: 15, color: colors.textPrimary, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandBrown, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: colors.borderMedium },
});
