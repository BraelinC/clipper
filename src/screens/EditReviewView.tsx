import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Video from 'react-native-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CONVEX_URL = 'https://wary-panther-105.convex.cloud';

type Message = {
  _id: string;
  _creationTime: number;
  role: 'user' | 'assistant';
  content: string;
  videoUrl?: string;
};

type Edit = {
  _id: string;
  clipId: string;
  prompt: string;
  status: string;
  clipTitle: string;
  clipUrl?: string;
};

type Props = {
  editId: string;
  onBack: () => void;
};

export default function EditReviewView({ editId, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  
  const [edit, setEdit] = useState<Edit | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  // Fetch edit details and messages
  const fetchData = async () => {
    try {
      // Fetch edit
      const editRes = await fetch(`${CONVEX_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'edits:get', args: { editId } }),
      });
      const editData = await editRes.json();
      if (editData.value) setEdit(editData.value);

      // Fetch messages
      const msgRes = await fetch(`${CONVEX_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'editMessages:list', args: { editId } }),
      });
      const msgData = await msgRes.json();
      setMessages(msgData.value || []);
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll for new messages every 3 seconds
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [editId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;
    
    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      await fetch(`${CONVEX_URL}/api/mutation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'editMessages:send',
          args: { editId, content: text },
        }),
      });
      
      // Refresh messages
      await fetchData();
    } catch (error) {
      console.error('Failed to send:', error);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={[S.root, { paddingTop: insets.top }]}>
        <View style={S.loadingContainer}>
          <ActivityIndicator size="large" color="#6c5ce7" />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[S.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={onBack} style={S.backBtn}>
          <Text style={S.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle} numberOfLines={1}>
          {edit?.clipTitle || 'Edit'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Original Video Preview */}
      {edit?.clipUrl && (
        <TouchableOpacity 
          style={S.originalPreview}
          onPress={() => setPlayingVideo(playingVideo === edit.clipUrl ? null : edit.clipUrl)}
        >
          <Video
            source={{ uri: edit.clipUrl }}
            style={S.previewVideo}
            resizeMode="cover"
            paused={playingVideo !== edit.clipUrl}
            repeat
            muted={playingVideo !== edit.clipUrl}
          />
          <View style={S.previewOverlay}>
            <Text style={S.previewLabel}>Original</Text>
            <Text style={S.playIcon}>{playingVideo === edit.clipUrl ? '⏸' : '▶️'}</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Chat Messages */}
      <ScrollView 
        ref={scrollRef}
        style={S.chatContainer}
        contentContainerStyle={S.chatContent}
      >
        {messages.length === 0 ? (
          <View style={S.emptyChat}>
            <Text style={S.emptyChatText}>👋 Tell me how you want to edit this video!</Text>
            <Text style={S.emptyChatHint}>
              Examples:{'\n'}
              • "Add captions"{'\n'}
              • "Cut the first 5 seconds"{'\n'}
              • "Speed up 2x"{'\n'}
              • "Add trending music"
            </Text>
          </View>
        ) : (
          messages.map((msg) => (
            <View 
              key={msg._id} 
              style={[S.messageBubble, msg.role === 'user' ? S.userBubble : S.assistantBubble]}
            >
              {msg.role === 'assistant' && (
                <Text style={S.assistantLabel}>🤖 Silas</Text>
              )}
              <Text style={[S.messageText, msg.role === 'user' && S.userText]}>
                {msg.content}
              </Text>
              {msg.videoUrl && (
                <TouchableOpacity 
                  style={S.videoMessage}
                  onPress={() => setPlayingVideo(playingVideo === msg.videoUrl ? null : msg.videoUrl)}
                >
                  <Video
                    source={{ uri: msg.videoUrl }}
                    style={S.messageVideo}
                    resizeMode="cover"
                    paused={playingVideo !== msg.videoUrl}
                    repeat
                  />
                  <View style={S.videoPlayOverlay}>
                    <Text style={S.videoPlayIcon}>
                      {playingVideo === msg.videoUrl ? '⏸' : '▶️'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Input Bar */}
      <View style={[S.inputBar, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput
          style={S.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Tell me what to edit..."
          placeholderTextColor="#666"
          multiline
          maxLength={500}
        />
        <TouchableOpacity 
          style={[S.sendBtn, (!inputText.trim() || sending) && S.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={S.sendBtnText}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },
  
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backBtn: { paddingVertical: 5, paddingRight: 10 },
  backText: { color: '#6c5ce7', fontSize: 16, fontWeight: '600' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },

  originalPreview: {
    height: 120,
    marginHorizontal: 15,
    marginVertical: 10,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  previewVideo: { width: '100%', height: '100%' },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  playIcon: { fontSize: 30 },

  chatContainer: { flex: 1 },
  chatContent: { padding: 15, paddingBottom: 20 },

  emptyChat: { 
    alignItems: 'center', 
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyChatText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 15,
  },
  emptyChatHint: {
    color: '#9e9e9e',
    fontSize: 14,
    lineHeight: 24,
    textAlign: 'center',
  },

  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#6c5ce7',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#16213e',
    borderBottomLeftRadius: 4,
  },
  assistantLabel: {
    color: '#e84393',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  messageText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  userText: { color: '#fff' },

  videoMessage: {
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
    aspectRatio: 9 / 16,
    maxHeight: 250,
  },
  messageVideo: { width: '100%', height: '100%' },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayIcon: { fontSize: 40 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#1a1a2e',
  },
  input: {
    flex: 1,
    backgroundColor: '#16213e',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingRight: 45,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
    marginRight: 10,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6c5ce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#333' },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
});
