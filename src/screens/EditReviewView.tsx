import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Dimensions,
} from 'react-native';
import Video from 'react-native-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CONVEX_URL = 'https://wary-panther-105.convex.cloud';
const CONVEX_SITE_URL = 'https://wary-panther-105.convex.site';
const SCREEN_W = Dimensions.get('window').width;

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
  outputUrl?: string;
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
  const [aiThinking, setAiThinking] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [videoExpanded, setVideoExpanded] = useState(false);

  // Find the latest AI video from messages (most recent assistant message with videoUrl)
  const latestAiVideo = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].videoUrl) {
        return messages[i].videoUrl!;
      }
    }
    return null;
  }, [messages]);

  // The video to show in the preview: latest AI edit > edit outputUrl > original clip
  const currentVideoUrl = latestAiVideo || edit?.outputUrl || edit?.clipUrl;
  const videoLabel = latestAiVideo ? 'AI Edit' : edit?.outputUrl ? 'Edited' : 'Original';

  // Fetch edit details and messages
  const fetchData = async () => {
    try {
      const editRes = await fetch(`${CONVEX_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'edits:get', args: { editId } }),
      });
      if (!editRes.ok) throw new Error(`Edit fetch failed: ${editRes.status}`);
      const editData = await editRes.json();
      if (editData.value) setEdit(editData.value);

      const msgRes = await fetch(`${CONVEX_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'editMessages:list', args: { editId } }),
      });
      if (!msgRes.ok) throw new Error(`Messages fetch failed: ${msgRes.status}`);
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
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [editId]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    const text = inputText.trim();
    setSending(true);
    setInputText('');

    try {
      // 1. Save user message locally
      const res = await fetch(`${CONVEX_URL}/api/mutation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'editMessages:send',
          args: { editId, content: text },
        }),
      });
      if (!res.ok) throw new Error(`Send failed: ${res.status}`);
      await fetchData();

      // 2. Trigger AI processing with local Qwen model
      setAiThinking(true);
      const processRes = await fetch(`${CONVEX_SITE_URL}/process-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editId, message: text }),
      });

      if (!processRes.ok) {
        console.error('AI processing failed:', await processRes.text());
        setAiThinking(false);
        return;
      }

      const processData = await processRes.json();
      const { conversationId } = processData;

      // 3. Poll for AI response with streaming updates
      if (conversationId) {
        let attempts = 0;
        const maxAttempts = 120; // 2 minutes max for local model

        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const pollRes = await fetch(`${CONVEX_SITE_URL}/poll-response`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ conversationId, editId }),
            });

            if (pollRes.ok) {
              const pollData = await pollRes.json();

              // Show streaming content (tool calls, partial responses)
              if (pollData.status === 'streaming' && pollData.streamingContent) {
                setStreamingContent(pollData.streamingContent);
              }

              if (pollData.status === 'complete') {
                clearInterval(pollInterval);
                setAiThinking(false);
                setStreamingContent('');
                await fetchData();
              }
            }
          } catch (err) {
            console.error('Poll error:', err);
          }

          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setAiThinking(false);
            setStreamingContent('');
          }
        }, 500); // Poll every 500ms for smoother streaming
      } else {
        setAiThinking(false);
      }
    } catch (error) {
      console.error('Failed to send:', error);
      setAiThinking(false);
    } finally {
      setSending(false);
    }
  };

  const toggleVideoExpand = () => {
    setVideoExpanded(!videoExpanded);
    if (!videoExpanded && currentVideoUrl) {
      setPlayingVideo(currentVideoUrl);
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

      {/* Video Preview — expandable */}
      {currentVideoUrl && (
        <View style={[S.videoSection, videoExpanded && S.videoSectionExpanded]}>
          <TouchableOpacity
            style={[S.videoContainer, videoExpanded && S.videoContainerExpanded]}
            activeOpacity={0.9}
            onPress={() => setPlayingVideo(playingVideo === currentVideoUrl ? null : currentVideoUrl)}
          >
            <Video
              source={{ uri: currentVideoUrl }}
              style={S.previewVideo}
              resizeMode={videoExpanded ? 'contain' : 'cover'}
              paused={playingVideo !== currentVideoUrl}
              repeat
              muted={playingVideo !== currentVideoUrl}
            />
            {playingVideo !== currentVideoUrl && (
              <View style={S.previewOverlay}>
                <Text style={S.bigPlayIcon}>▶️</Text>
              </View>
            )}
            {/* Label badge */}
            <View style={[S.labelBadge, latestAiVideo ? S.labelAi : S.labelOriginal]}>
              <Text style={S.labelText}>{videoLabel}</Text>
            </View>
          </TouchableOpacity>

          {/* Expand/collapse toggle */}
          <TouchableOpacity style={S.expandBtn} onPress={toggleVideoExpand}>
            <Text style={S.expandIcon}>{videoExpanded ? '▲' : '▼'}</Text>
            <Text style={S.expandText}>{videoExpanded ? 'Collapse' : 'Expand'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Chat Messages */}
      <ScrollView
        ref={scrollRef}
        style={S.chatContainer}
        contentContainerStyle={S.chatContent}
      >
        {messages.length === 0 ? (
          <View style={S.emptyChat}>
            <Text style={S.emptyChatText}>Tell me how you want to edit this video!</Text>
            <Text style={S.emptyChatHint}>
              Examples:{'\n'}
              • "Add captions"{'\n'}
              • "Cut the first 5 seconds"{'\n'}
              • "Speed up 2x"{'\n'}
              • "Add trending music"
            </Text>
          </View>
        ) : (
          <>
          {messages.map((msg) => (
            <View
              key={msg._id}
              style={[S.messageBubble, msg.role === 'user' ? S.userBubble : S.assistantBubble]}
            >
              {msg.role === 'assistant' && (
                <Text style={S.assistantLabel}>Qwen Local</Text>
              )}
              <Text style={[S.messageText, msg.role === 'user' && S.userText]}>
                {msg.content}
              </Text>
              {msg.videoUrl && (
                <TouchableOpacity
                  style={S.videoMessage}
                  onPress={() => {
                    setPlayingVideo(playingVideo === msg.videoUrl ? null : msg.videoUrl);
                  }}
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
                  {/* Indicator that this is the current preview video */}
                  {msg.videoUrl === latestAiVideo && (
                    <View style={S.currentBadge}>
                      <Text style={S.currentBadgeText}>Current</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))}
          {/* AI Thinking/Streaming indicator */}
          {aiThinking && (
            <View style={[S.messageBubble, S.assistantBubble]}>
              <Text style={S.assistantLabel}>Qwen Local</Text>
              {streamingContent ? (
                <Text style={S.streamingText}>{streamingContent}▋</Text>
              ) : (
                <View style={S.thinkingRow}>
                  <ActivityIndicator size="small" color="#a29bfe" />
                  <Text style={S.thinkingText}>Thinking...</Text>
                </View>
              )}
            </View>
          )}
          </>
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

  // Video section
  videoSection: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoSectionExpanded: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
  },
  videoContainer: {
    height: 120,
  },
  videoContainerExpanded: {
    height: SCREEN_W * (16 / 9),
    maxHeight: 400,
  },
  previewVideo: { width: '100%', height: '100%' },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigPlayIcon: { fontSize: 40 },

  labelBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  labelOriginal: {
    backgroundColor: 'rgba(108, 92, 231, 0.8)',
  },
  labelAi: {
    backgroundColor: 'rgba(232, 67, 147, 0.85)',
  },
  labelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  expandIcon: {
    color: '#a29bfe',
    fontSize: 12,
    marginRight: 6,
  },
  expandText: {
    color: '#a29bfe',
    fontSize: 13,
    fontWeight: '600',
  },

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

  currentBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(232, 67, 147, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

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

  // AI thinking indicator
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thinkingText: {
    color: '#a29bfe',
    fontSize: 14,
    marginLeft: 8,
    fontStyle: 'italic',
  },
  // Streaming content (tool calls, partial responses)
  streamingText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 21,
    opacity: 0.9,
  },
});
