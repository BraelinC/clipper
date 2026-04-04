import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CONVEX_URL = 'https://wary-panther-105.convex.cloud';

type Edit = {
  _id: string;
  _creationTime: number;
  clipId: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  outputUrl?: string;
  thumbnailUrl?: string;
  clipTitle: string;
  clipUrl?: string;
  approval: { approved: boolean; feedback?: string } | null;
};

type Props = {
  onSelectEdit: (editId: string) => void;
};

export default function EditsScreen({ onSelectEdit }: Props) {
  const insets = useSafeAreaInsets();
  const [edits, setEdits] = useState<Edit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEdits = useCallback(async () => {
    try {
      const response = await fetch(`${CONVEX_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'edits:list', args: {} }),
      });
      const data = await response.json();
      setEdits(data.value || []);
    } catch (error) {
      console.error('Failed to fetch edits:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEdits();
  }, [fetchEdits]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEdits();
  }, [fetchEdits]);

  const getStatusBadge = (edit: Edit) => {
    if (edit.approval) {
      return edit.approval.approved
        ? { text: 'Approved', color: '#2ed573', bg: 'rgba(46, 213, 115, 0.15)' }
        : { text: 'Rejected', color: '#ff6b81', bg: 'rgba(255, 107, 129, 0.15)' };
    }

    const statusMap: Record<string, { text: string; color: string; bg: string }> = {
      pending: { text: 'Pending', color: '#ffa502', bg: 'rgba(255, 165, 2, 0.15)' },
      processing: { text: 'Processing', color: '#70a1ff', bg: 'rgba(112, 161, 255, 0.15)' },
      completed: { text: 'Ready', color: '#2ed573', bg: 'rgba(46, 213, 115, 0.15)' },
      failed: { text: 'Failed', color: '#ff4757', bg: 'rgba(255, 71, 87, 0.15)' },
    };

    return statusMap[edit.status] || statusMap.pending;
  };

  if (loading) {
    return (
      <View style={[S.root, { paddingTop: insets.top }]}>
        <View style={S.loadingContainer}>
          <ActivityIndicator size="large" color="#6c5ce7" />
          <Text style={S.loadingText}>Loading edits...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[S.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={S.pad}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6c5ce7"
            colors={['#6c5ce7']}
          />
        }
      >
        <Text style={S.title}>AI Edits</Text>
        <Text style={S.subtitle}>Review your AI-edited videos</Text>

        {edits.length === 0 ? (
          <View style={S.emptyContainer}>
            <Text style={S.emptyIcon}>🎬</Text>
            <Text style={S.emptyTitle}>No edits yet</Text>
            <Text style={S.emptyText}>
              AI-edited videos will appear here for your review
            </Text>
          </View>
        ) : (
          edits.map((edit) => {
            const badge = getStatusBadge(edit);
            return (
              <TouchableOpacity
                key={edit._id}
                style={S.editCard}
                onPress={() => onSelectEdit(edit._id)}
                activeOpacity={0.7}
              >
                {/* Thumbnail */}
                <View style={S.thumbnailContainer}>
                  {edit.thumbnailUrl || edit.clipUrl ? (
                    <Image
                      source={{ uri: edit.thumbnailUrl || edit.clipUrl }}
                      style={S.thumbnail}
                    />
                  ) : (
                    <View style={S.thumbnailPlaceholder}>
                      <Text style={S.thumbnailIcon}>🎥</Text>
                    </View>
                  )}
                  {/* Play icon overlay */}
                  <View style={S.playOverlay}>
                    <Text style={S.playIcon}>▶</Text>
                  </View>
                </View>

                {/* Info */}
                <View style={S.editInfo}>
                  <View style={S.editHeader}>
                    <Text style={S.editTitle} numberOfLines={1}>
                      {edit.clipTitle}
                    </Text>
                    <View style={[S.statusBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[S.statusText, { color: badge.color }]}>
                        {badge.text}
                      </Text>
                    </View>
                  </View>

                  <Text style={S.promptText} numberOfLines={2}>
                    "{edit.prompt}"
                  </Text>

                  <Text style={S.dateText}>
                    {new Date(edit._creationTime).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },
  pad: { padding: 20, paddingBottom: 100 },

  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#9e9e9e',
    marginBottom: 20,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9e9e9e',
    marginTop: 12,
    fontSize: 14,
  },

  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9e9e9e',
    textAlign: 'center',
  },

  editCard: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },

  thumbnailContainer: {
    width: 100,
    height: 100,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0f3460',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailIcon: {
    fontSize: 24,
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 20,
    color: '#fff',
  },

  editInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  editTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  promptText: {
    fontSize: 13,
    color: '#a29bfe',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  dateText: {
    fontSize: 11,
    color: '#666',
  },
});
