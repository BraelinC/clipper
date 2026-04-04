import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';

const CONVEX_URL = 'https://wary-panther-105.convex.cloud';

type EditDetails = {
  _id: string;
  _creationTime: number;
  clipId: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  outputUrl?: string;
  error?: string;
  clipTitle: string;
  clipUrl?: string;
  approval: { approved: boolean; feedback?: string } | null;
};

type Props = {
  editId: string;
  onBack: () => void;
};

export default function EditReviewView({ editId, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [edit, setEdit] = useState<EditDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    fetchEdit();
  }, [editId]);

  const fetchEdit = async () => {
    try {
      const response = await fetch(`${CONVEX_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'edits:get',
          args: { editId },
        }),
      });
      const data = await response.json();
      setEdit(data.value);
    } catch (error) {
      console.error('Failed to fetch edit:', error);
      Alert.alert('Error', 'Failed to load edit details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!edit) return;
    setSubmitting(true);

    try {
      await fetch(`${CONVEX_URL}/api/mutation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'approvals:approve',
          args: { editId: edit._id },
        }),
      });

      Alert.alert('Approved!', 'This edit is ready for posting.', [
        { text: 'OK', onPress: onBack },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to approve edit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!edit || !feedback.trim()) {
      Alert.alert('Feedback required', 'Please provide feedback for rejection');
      return;
    }
    setSubmitting(true);

    try {
      await fetch(`${CONVEX_URL}/api/mutation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'approvals:reject',
          args: { editId: edit._id, feedback: feedback.trim() },
        }),
      });

      Alert.alert('Rejected', 'Feedback sent for re-editing.', [
        { text: 'OK', onPress: onBack },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to reject edit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[S.root, { paddingTop: insets.top }]}>
        <View style={S.loadingContainer}>
          <ActivityIndicator size="large" color="#6c5ce7" />
          <Text style={S.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!edit) {
    return (
      <View style={[S.root, { paddingTop: insets.top }]}>
        <View style={S.loadingContainer}>
          <Text style={S.errorText}>Edit not found</Text>
          <TouchableOpacity style={S.backBtn} onPress={onBack}>
            <Text style={S.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const videoUrl = edit.outputUrl || edit.clipUrl;
  const isCompleted = edit.status === 'completed';
  const hasApproval = edit.approval !== null;

  return (
    <View style={[S.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={S.pad}>
        {/* Header */}
        <View style={S.header}>
          <TouchableOpacity onPress={onBack} style={S.backButton}>
            <Text style={S.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={S.title} numberOfLines={1}>
            {edit.clipTitle}
          </Text>
        </View>

        {/* Video Player */}
        <View style={S.videoContainer}>
          {videoUrl ? (
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setPaused(!paused)}
              style={S.videoTouchable}
            >
              <Video
                source={{ uri: videoUrl }}
                style={S.video}
                controls={true}
                resizeMode="contain"
                paused={paused}
                repeat={true}
              />
            </TouchableOpacity>
          ) : (
            <View style={S.noVideoContainer}>
              <Text style={S.noVideoText}>Video not available</Text>
            </View>
          )}
        </View>

        {/* Status Badge */}
        <View style={S.statusContainer}>
          {edit.status === 'processing' && (
            <View style={[S.bigBadge, S.processingBadge]}>
              <ActivityIndicator size="small" color="#70a1ff" />
              <Text style={S.processingText}>Processing...</Text>
            </View>
          )}
          {edit.status === 'failed' && (
            <View style={[S.bigBadge, S.failedBadge]}>
              <Text style={S.failedText}>Failed: {edit.error || 'Unknown error'}</Text>
            </View>
          )}
          {hasApproval && (
            <View
              style={[
                S.bigBadge,
                edit.approval?.approved ? S.approvedBadge : S.rejectedBadge,
              ]}
            >
              <Text
                style={edit.approval?.approved ? S.approvedText : S.rejectedText}
              >
                {edit.approval?.approved ? '✓ Approved' : '✗ Rejected'}
              </Text>
              {edit.approval?.feedback && (
                <Text style={S.feedbackText}>
                  "{edit.approval.feedback}"
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Prompt */}
        <View style={S.promptCard}>
          <Text style={S.promptLabel}>Edit Prompt</Text>
          <Text style={S.promptText}>"{edit.prompt}"</Text>
        </View>

        {/* Action Buttons */}
        {isCompleted && !hasApproval && (
          <View style={S.actionsContainer}>
            {!showRejectInput ? (
              <>
                <TouchableOpacity
                  style={[S.actionBtn, S.approveBtn, submitting && S.disabled]}
                  onPress={handleApprove}
                  disabled={submitting}
                >
                  <Text style={S.approveBtnText}>
                    {submitting ? 'Approving...' : '✓ Approve'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[S.actionBtn, S.rejectBtn]}
                  onPress={() => setShowRejectInput(true)}
                >
                  <Text style={S.rejectBtnText}>✗ Reject</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={S.rejectInputContainer}>
                <Text style={S.rejectLabel}>Why are you rejecting?</Text>
                <TextInput
                  style={S.feedbackInput}
                  value={feedback}
                  onChangeText={setFeedback}
                  placeholder="e.g., Captions are too small, remove the last 2 seconds..."
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={3}
                />
                <View style={S.rejectActions}>
                  <TouchableOpacity
                    style={S.cancelRejectBtn}
                    onPress={() => {
                      setShowRejectInput(false);
                      setFeedback('');
                    }}
                  >
                    <Text style={S.cancelRejectText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[S.confirmRejectBtn, submitting && S.disabled]}
                    onPress={handleReject}
                    disabled={submitting}
                  >
                    <Text style={S.confirmRejectText}>
                      {submitting ? 'Sending...' : 'Send Feedback'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Post to Instagram button (after approval) */}
        {hasApproval && edit.approval?.approved && (
          <TouchableOpacity
            style={S.instagramBtn}
            onPress={() => Alert.alert('Coming Soon', 'Instagram posting will be available soon!')}
          >
            <Text style={S.instagramBtnText}>📱 Post to Instagram</Text>
          </TouchableOpacity>
        )}

        {/* Metadata */}
        <View style={S.metaContainer}>
          <Text style={S.metaText}>
            Created: {new Date(edit._creationTime).toLocaleString()}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },
  pad: { padding: 20, paddingBottom: 100 },

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
  errorText: {
    color: '#ff6b81',
    fontSize: 16,
    marginBottom: 20,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#16213e',
    borderRadius: 8,
  },
  backBtnText: {
    color: '#70a1ff',
    fontSize: 14,
    fontWeight: '600',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  backArrow: {
    fontSize: 24,
    color: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },

  videoContainer: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 16,
  },
  videoTouchable: {
    width: '100%',
    height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  noVideoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noVideoText: {
    color: '#666',
    fontSize: 14,
  },

  statusContainer: {
    marginBottom: 16,
  },
  bigBadge: {
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  processingBadge: {
    backgroundColor: 'rgba(112, 161, 255, 0.15)',
  },
  processingText: {
    color: '#70a1ff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  failedBadge: {
    backgroundColor: 'rgba(255, 71, 87, 0.15)',
  },
  failedText: {
    color: '#ff4757',
    fontSize: 14,
  },
  approvedBadge: {
    backgroundColor: 'rgba(46, 213, 115, 0.15)',
  },
  approvedText: {
    color: '#2ed573',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectedBadge: {
    backgroundColor: 'rgba(255, 107, 129, 0.15)',
  },
  rejectedText: {
    color: '#ff6b81',
    fontSize: 16,
    fontWeight: '600',
  },
  feedbackText: {
    color: '#9e9e9e',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 6,
    width: '100%',
  },

  promptCard: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  promptLabel: {
    color: '#666',
    fontSize: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  promptText: {
    color: '#a29bfe',
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
  },

  actionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  actionBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  approveBtn: {
    backgroundColor: '#2ed573',
  },
  approveBtnText: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: '700',
  },
  rejectBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#ff6b81',
  },
  rejectBtnText: {
    color: '#ff6b81',
    fontSize: 18,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },

  rejectInputContainer: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
  },
  rejectLabel: {
    color: '#ff6b81',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  feedbackInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rejectActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cancelRejectBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2d3436',
    alignItems: 'center',
  },
  cancelRejectText: {
    color: '#9e9e9e',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmRejectBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#ff6b81',
    alignItems: 'center',
  },
  confirmRejectText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  instagramBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#833AB4',
    shadowColor: '#833AB4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  instagramBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  metaContainer: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 16,
  },
  metaText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
});
