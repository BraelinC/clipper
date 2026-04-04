import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  AppState,
  PermissionsAndroid,
  Platform,
  ScrollView,
  TextInput,
  Image,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { NativeModules, NativeEventEmitter } from 'react-native';
import Video from 'react-native-video';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EditsScreen from './src/screens/EditsScreen';
import EditReviewView from './src/screens/EditReviewView';

const { ScreenRecorderModule } = NativeModules;
const SCREEN_W = Dimensions.get('window').width;

type Recording = { path: string; date: string; name: string };
type Crop = { top: string; bottom: string; left: string; right: string };
type Segment = { start: number; end: number; speed: number; crop: Crop };

const STORAGE_KEY = '@recordings';
const NO_CROP: Crop = { top: '0', bottom: '0', left: '0', right: '0' };
const CONVEX_URL = 'https://wary-panther-105.convex.cloud';

type Tab = 'record' | 'edits';

const saveClipToConvex = async (url: string, title: string, source: 'recorded' | 'uploaded' | 'edited', duration?: number, fileSize?: number) => {
  try {
    await fetch(`${CONVEX_URL}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'clips:create',
        args: { title, url, source, duration, fileSize },
      }),
    });
  } catch {}
};
const SEG_COLORS = ['#2ed573', '#ffa502', '#ff6b81', '#70a1ff', '#a29bfe', '#fd79a8', '#55efc4'];
const THUMB_COUNT = 20;
const HANDLE_W = 16;

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, '0')}`;
};

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('record');
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

        {/* Screen Content */}
        {activeTab === 'record' && <AppContent />}
        {activeTab === 'edits' && !selectedEditId && (
          <EditsScreen onSelectEdit={(id) => setSelectedEditId(id)} />
        )}
        {activeTab === 'edits' && selectedEditId && (
          <EditReviewView
            editId={selectedEditId}
            onBack={() => setSelectedEditId(null)}
          />
        )}

        {/* Tab Bar */}
        <TabBar activeTab={activeTab} onTabChange={(tab) => {
          setActiveTab(tab);
          setSelectedEditId(null);
        }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function TabBar({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[TAB.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <TouchableOpacity
        style={[TAB.tab, activeTab === 'record' && TAB.activeTab]}
        onPress={() => onTabChange('record')}
      >
        <Text style={[TAB.icon, activeTab === 'record' && TAB.activeIcon]}>⏺</Text>
        <Text style={[TAB.label, activeTab === 'record' && TAB.activeLabel]}>Record</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[TAB.tab, activeTab === 'edits' && TAB.activeTab]}
        onPress={() => onTabChange('edits')}
      >
        <Text style={[TAB.icon, activeTab === 'edits' && TAB.activeIcon]}>🎬</Text>
        <Text style={[TAB.label, activeTab === 'edits' && TAB.activeLabel]}>Edits</Text>
      </TouchableOpacity>
    </View>
  );
}

const TAB = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  activeTab: {},
  icon: {
    fontSize: 20,
    marginBottom: 4,
    opacity: 0.5,
  },
  activeIcon: {
    opacity: 1,
  },
  label: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  activeLabel: {
    color: '#6c5ce7',
  },
});

// ==================== FILMSTRIP TIMELINE ====================

type DragTarget = { segIdx: number; edge: 'start' | 'end' } | { type: 'playhead' };

function FilmstripTimeline({
  thumbnails,
  duration,
  segments,
  curTime,
  lockStart,
  lockEnd,
  onTapSplit,
  onHandleDrag,
  onSeek,
}: {
  thumbnails: string[];
  duration: number;
  segments: Segment[];
  curTime: number;
  lockStart: number | null;
  lockEnd: number | null;
  onTapSplit: (t: number) => void;
  onHandleDrag: (segIdx: number, edge: 'start' | 'end', newTime: number) => void;
  onSeek: (t: number) => void;
}) {
  const [stripWidth, setStripWidth] = useState(SCREEN_W - 40);
  const dragTargetRef = useRef<DragTarget | null>(null);
  const segmentsRef = useRef(segments);
  const durationRef = useRef(duration);
  const stripWidthRef = useRef(stripWidth);
  segmentsRef.current = segments;
  durationRef.current = duration;
  stripWidthRef.current = stripWidth;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setStripWidth(w);
    stripWidthRef.current = w;
  };

  const timeToX = (t: number) => duration > 0 ? (t / duration) * stripWidth : 0;
  const xToTime = (x: number, sw: number, dur: number) => Math.max(0, Math.min(dur, (x / sw) * dur));

  const curTimeXRef = useRef(curTime);
  curTimeXRef.current = curTime;

  const findNearestTarget = (x: number): DragTarget | null => {
    const sw = stripWidthRef.current;
    const dur = durationRef.current;
    const segs = segmentsRef.current;
    let best: DragTarget | null = null;
    let bestDist = 35; // generous grab distance

    // Check playhead first (highest priority, 25px grab)
    const playheadX = dur > 0 ? (curTimeXRef.current / dur) * sw : 0;
    if (Math.abs(x - playheadX) < 25) {
      bestDist = Math.abs(x - playheadX);
      best = { type: 'playhead' } as DragTarget;
    }

    // Check segment handles
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].speed === 0) continue;
      const sX = dur > 0 ? (segs[i].start / dur) * sw : 0;
      const eX = dur > 0 ? (segs[i].end / dur) * sw : 0;
      if (Math.abs(x - sX) < bestDist) { bestDist = Math.abs(x - sX); best = { segIdx: i, edge: 'start' }; }
      if (Math.abs(x - eX) < bestDist) { bestDist = Math.abs(x - eX); best = { segIdx: i, edge: 'end' }; }
    }
    return best;
  };

  // Named bridge functions for runOnJS (anonymous closures crash in release)
  const handlePanBegin = (x: number) => {
    curTimeXRef.current = curTime;
    dragTargetRef.current = findNearestTarget(x);
  };

  const handlePanUpdate = (x: number) => {
    const target = dragTargetRef.current;
    if (!target) return;
    const t = xToTime(x, stripWidthRef.current, durationRef.current);
    if ('type' in target && target.type === 'playhead') {
      onSeek(t);
    } else if ('segIdx' in target) {
      onHandleDrag(target.segIdx, target.edge, t);
    }
  };

  const handlePanEnd = () => {
    dragTargetRef.current = null;
  };

  const handleTap = (x: number) => {
    const sw = stripWidthRef.current;
    const dur = durationRef.current;
    const t = xToTime(x, sw, dur);
    // Tap anywhere on filmstrip = seek (move red line). Use SPLIT button to split.
    onSeek(t);
  };

  const startX = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX([-5, 5])
    .failOffsetY([-20, 20])
    .minDistance(3)
    .onBegin((e) => {
      startX.value = e.x;
      runOnJS(handlePanBegin)(e.x);
    })
    .onUpdate((e) => {
      runOnJS(handlePanUpdate)(e.x);
    })
    .onEnd(() => {
      runOnJS(handlePanEnd)();
    });

  const tap = Gesture.Tap()
    .maxDuration(300)
    .onEnd((e) => {
      runOnJS(handleTap)(e.x);
    });

  const gesture = Gesture.Race(pan, tap);

  return (
    <View style={FS.wrapper} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={FS.strip}>
          {/* Frame thumbnails */}
          <View style={FS.thumbRow}>
            {thumbnails.map((uri, i) => (
              uri
                ? <Image key={i} source={{ uri }} style={[FS.thumb, { width: stripWidth / Math.max(thumbnails.length, 1) }]} />
                : <View key={i} style={[FS.thumb, { width: stripWidth / Math.max(thumbnails.length, 1), backgroundColor: '#222' }]} />
            ))}
          </View>

          {/* Dim deleted segments */}
          {segments.map((seg, i) => {
            if (seg.speed !== 0) return null;
            return (
              <View key={`dim-${i}`} pointerEvents="none" style={[FS.dimOverlay, {
                left: timeToX(seg.start),
                width: Math.max(timeToX(seg.end) - timeToX(seg.start), 1),
              }]} />
            );
          })}

          {/* Segment borders + handles */}
          {segments.map((seg, i) => {
            if (seg.speed === 0) return null;
            const l = timeToX(seg.start);
            const r = timeToX(seg.end);
            const w = r - l;
            const c = SEG_COLORS[i % SEG_COLORS.length];
            return (
              <React.Fragment key={`seg-${i}`}>
                <View pointerEvents="none" style={[FS.border, {
                  left: l + HANDLE_W / 2, width: Math.max(w - HANDLE_W, 0), borderColor: c,
                }]} />
                {/* Left handle */}
                <View pointerEvents="none" style={[FS.handle, { left: l - 1, backgroundColor: c }]}>
                  <View style={FS.grip} /><View style={FS.grip} />
                </View>
                {/* Right handle */}
                <View pointerEvents="none" style={[FS.handle, { left: r - HANDLE_W + 1, backgroundColor: c }]}>
                  <View style={FS.grip} /><View style={FS.grip} />
                </View>
                {/* Segment label */}
                <View pointerEvents="none" style={[FS.segLabel, { left: l + w / 2 - 20, top: 30 }]}>
                  <Text style={FS.segLabelText}>
                    {seg.speed !== 1 ? `${seg.speed}x` : `Seg ${i + 1}`}
                  </Text>
                </View>
              </React.Fragment>
            );
          })}

          {/* Lock region highlight */}
          {lockStart !== null && lockEnd !== null && (
            <View pointerEvents="none" style={[FS.lockRegion, {
              left: timeToX(Math.min(lockStart, lockEnd)),
              width: Math.max(timeToX(Math.max(lockStart, lockEnd)) - timeToX(Math.min(lockStart, lockEnd)), 2),
            }]} />
          )}
          {lockStart !== null && (
            <View pointerEvents="none" style={[FS.lockMarker, { left: timeToX(lockStart) - 1 }]} />
          )}
          {lockEnd !== null && (
            <View pointerEvents="none" style={[FS.lockMarker, { left: timeToX(lockEnd) - 1 }]} />
          )}

          {/* Playhead — draggable */}
          <View pointerEvents="none" style={[FS.playhead, { left: timeToX(curTime) - 1 }]}>
            <View style={FS.playheadHead} />
          </View>
        </Animated.View>
      </GestureDetector>

      {/* Time info */}
      <View style={FS.infoRow}>
        <Text style={FS.infoTime}>{fmt(0)}</Text>
        <Text style={FS.infoCurrent}>{fmt(curTime)}</Text>
        <Text style={FS.infoTime}>{fmt(duration)}</Text>
      </View>
    </View>
  );
}

const FS = StyleSheet.create({
  wrapper: { marginBottom: 8 },
  strip: { height: 80, borderRadius: 6, overflow: 'visible', position: 'relative' },
  thumbRow: { flexDirection: 'row', height: 80, borderRadius: 6, overflow: 'hidden' },
  thumb: { height: 80, resizeMode: 'cover' },
  dimOverlay: { position: 'absolute', top: 0, height: 80, backgroundColor: 'rgba(0,0,0,0.75)' },
  border: { position: 'absolute', top: 0, height: 80, borderTopWidth: 3, borderBottomWidth: 3 },
  handle: {
    position: 'absolute', top: 0, width: HANDLE_W, height: 80,
    borderRadius: 4, justifyContent: 'center', alignItems: 'center', zIndex: 10,
  },
  grip: { width: 2, height: 20, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 1, marginVertical: 2 },
  segLabel: { position: 'absolute', width: 40, alignItems: 'center' },
  segLabelText: { color: '#fff', fontSize: 10, fontWeight: 'bold', textShadowColor: '#000', textShadowRadius: 3 },
  lockRegion: { position: 'absolute', top: 0, height: 80, backgroundColor: 'rgba(255,255,255,0.15)', zIndex: 5 },
  lockMarker: { position: 'absolute', top: 0, width: 3, height: 80, backgroundColor: '#ffd700', zIndex: 15 },
  playhead: { position: 'absolute', top: -10, width: 3, height: 100, backgroundColor: '#ff4757', borderRadius: 2, zIndex: 20 },
  playheadHead: { position: 'absolute', top: 0, left: -5, width: 13, height: 10, backgroundColor: '#ff4757', borderRadius: 3 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 2 },
  infoTime: { color: '#666', fontSize: 11 },
  infoCurrent: { color: '#fff', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
});

// ==================== MAIN APP ====================

function AppContent() {
  const insets = useSafeAreaInsets();
  const [isRecording, setIsRecording] = useState(false);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [curTime, setCurTime] = useState(0);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [loadingThumbs, setLoadingThumbs] = useState(false);
  const [paused, setPaused] = useState(true);

  const [segments, setSegments] = useState<Segment[]>([]);
  // Crop is now per-segment

  const videoRef = useRef<any>(null);
  const isStartingRef = useRef(false);
  const hasEditedRef = useRef(false);
  const curTimeRef = useRef(0);

  // Load saved recordings
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(data => {
      if (data) setRecordings(JSON.parse(data));
    }).catch(() => {});
  }, []);

  const saveRecording = async (path: string) => {
    const name = path.split('/').pop() || 'recording';
    const date = new Date().toLocaleString();
    const rec: Recording = { path, date, name };
    const updated = [rec, ...recordings.filter(r => r.path !== path)].slice(0, 50);
    setRecordings(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const deleteRecording = async (path: string) => {
    const updated = recordings.filter(r => r.path !== path);
    setRecordings(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const loadThumbnails = useCallback(async (path: string) => {
    setLoadingThumbs(true);
    try {
      const result = await ScreenRecorderModule.getVideoThumbnails(path, THUMB_COUNT);
      setThumbnails(result.thumbnails || []);
      if (result.duration > 0) setDuration(result.duration);
    } catch { setThumbnails([]); }
    setLoadingThumbs(false);
  }, []);

  // Sync with native
  useEffect(() => {
    const check = () => {
      if (isStartingRef.current || hasEditedRef.current) return;
      ScreenRecorderModule.getRecordingState().then((s: any) => {
        if (isStartingRef.current || hasEditedRef.current) return;
        if (s.isRecording) { setIsRecording(true); setVideoPath(null); }
        else if (s.outputPath) { setIsRecording(false); setVideoPath(s.outputPath); saveRecording(s.outputPath); }
        else { setIsRecording(false); }
      }).catch(() => {});
    };
    check();
    const sub = AppState.addEventListener('change', (ns) => { if (ns === 'active') check(); });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const emitter = new NativeEventEmitter(ScreenRecorderModule);
    const s1 = emitter.addListener('onRecordingStopped', (e) => {
      setIsRecording(false);
      setVideoPath(e.path || null);
      if (e.path) saveRecording(e.path);
    });
    const s2 = emitter.addListener('onRecordingError', (e) => { Alert.alert('Error', e.error); });
    return () => { s1.remove(); s2.remove(); };
  }, []);

  const startRecording = async () => {
    if (Platform.OS === 'android') {
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (r !== PermissionsAndroid.RESULTS.GRANTED) { Alert.alert('Permission Required'); return; }
      if (Number(Platform.Version) >= 33) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    isStartingRef.current = true;
    hasEditedRef.current = false;
    try {
      await ScreenRecorderModule.startRecording('fullscreen', { mic: true, fps: 60 });
      setIsRecording(true); setVideoPath(null); setEditMode(false);
      isStartingRef.current = false;
    } catch { isStartingRef.current = false; Alert.alert('Error', 'Failed to start'); }
  };

  // Locked preview bounds
  const [lockStart, setLockStart] = useState<number | null>(null);
  const [lockEnd, setLockEnd] = useState<number | null>(null);
  const lockStartRef = useRef<number | null>(null);
  const lockEndRef = useRef<number | null>(null);

  const findSegmentAt = (t: number): number => {
    for (let i = 0; i < segments.length; i++) {
      if (t >= segments[i].start - 0.05 && t <= segments[i].end + 0.05) return i;
    }
    return 0;
  };

  const getPreviewSpeed = (): number => {
    const idx = findSegmentAt(curTimeRef.current);
    return segments[idx]?.speed || 1;
  };

  const seekTo = (t: number) => {
    const c = Math.max(0, Math.min(duration, t));
    curTimeRef.current = c;
    setCurTime(c);
    videoRef.current?.seek(c);
  };

  // Range playback - uses onSeek to know when seek is done
  const rangePendingPlay = useRef(false);
  const rangeEndRef = useRef<number | null>(null);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const handleProgress = (d: any) => {
    const t = d.currentTime;
    curTimeRef.current = t;
    setCurTime(t);
    // Stop at end of range
    if (rangeEndRef.current !== null && !pausedRef.current && t >= rangeEndRef.current - 0.15) {
      rangeEndRef.current = null;
      rangePendingPlay.current = false;
      setPaused(true);
    }
  };

  const handleSeekComplete = (d: any) => {
    const t = d.seekTime ?? d.currentTime;
    curTimeRef.current = t;
    setCurTime(t);
    // If this seek was for range play, now start playing
    if (rangePendingPlay.current) {
      rangePendingPlay.current = false;
      setPaused(false);
    }
  };

  const handlePlaybackState = (d: any) => {
    // Don't let native override us while range is active
    if (rangePendingPlay.current || rangeEndRef.current !== null) return;
    if (d.isPlaying !== undefined) setPaused(!d.isPlaying);
  };

  const playRange = () => {
    if (lockStart === null || lockEnd === null) return;
    const start = Math.min(lockStart, lockEnd);
    const end = Math.max(lockStart, lockEnd);
    lockStartRef.current = start;
    lockEndRef.current = end;
    setLockStart(start);
    setLockEnd(end);
    // Set end bound, seek to start, onSeek will start playback
    rangeEndRef.current = end;
    rangePendingPlay.current = true;
    setPaused(true);
    videoRef.current?.seek(start);
  };

  // === EDIT ACTIONS ===

  const enterEdit = () => {
    setSegments([{ start: 0, end: duration, speed: 1, crop: { ...NO_CROP } }]);
    setPaused(true);
    curTimeRef.current = 0;
    setCurTime(0);
    setLockStart(null); setLockEnd(null);
    lockStartRef.current = null; lockEndRef.current = null;
    setEditMode(true);
    if (videoPath) loadThumbnails(videoPath);
  };

  const splitAtTime = (t: number) => {
    const idx = segments.findIndex(s => t > s.start + 0.2 && t < s.end - 0.2);
    if (idx === -1) return;
    const seg = segments[idx];
    const newSegs = [...segments];
    newSegs.splice(idx, 1,
      { start: seg.start, end: t, speed: seg.speed, crop: { ...seg.crop } },
      { start: t, end: seg.end, speed: 1, crop: { ...NO_CROP } },
    );
    setSegments(newSegs);
    seekTo(t);
  };

  const handleHandleDrag = (segIdx: number, edge: 'start' | 'end', newTime: number) => {
    setSegments(prev => {
      const segs = [...prev];
      const seg = segs[segIdx];
      if (edge === 'start') {
        const min = segIdx > 0 ? segs[segIdx - 1].start + 0.2 : 0;
        const max = seg.end - 0.2;
        const t = Math.max(min, Math.min(max, newTime));
        segs[segIdx] = { ...seg, start: t };
        if (segIdx > 0) segs[segIdx - 1] = { ...segs[segIdx - 1], end: t };
      } else {
        const min = seg.start + 0.2;
        const max = segIdx < segs.length - 1 ? segs[segIdx + 1].end - 0.2 : duration;
        const t = Math.max(min, Math.min(max, newTime));
        segs[segIdx] = { ...seg, end: t };
        if (segIdx < segs.length - 1) segs[segIdx + 1] = { ...segs[segIdx + 1], start: t };
      }
      return segs;
    });
  };

  const updateSpeed = (idx: number, val: string) => {
    const num = parseFloat(val);
    setSegments(prev => {
      const segs = [...prev];
      segs[idx] = { ...segs[idx], speed: isNaN(num) ? 0 : Math.max(0, num) };
      return segs;
    });
  };

  const toggleDelete = (idx: number) => {
    setSegments(prev => {
      const segs = [...prev];
      segs[idx] = { ...segs[idx], speed: segs[idx].speed === 0 ? 1 : 0 };
      return segs;
    });
  };

  const updateCrop = (idx: number, field: keyof Crop, val: string) => {
    setSegments(prev => {
      const segs = [...prev];
      segs[idx] = { ...segs[idx], crop: { ...segs[idx].crop, [field]: val } };
      return segs;
    });
  };

  const applyEdits = async () => {
    if (!videoPath) return;
    const kept = segments.filter(s => s.speed > 0 && s.end > s.start).map(s => ({
      start: s.start, end: s.end, speed: s.speed,
      cropTop: parseInt(s.crop.top) || 0,
      cropBottom: parseInt(s.crop.bottom) || 0,
      cropLeft: parseInt(s.crop.left) || 0,
      cropRight: parseInt(s.crop.right) || 0,
    }));
    if (kept.length === 0) { Alert.alert('Error', 'No segments to keep'); return; }
    setProcessing(true);
    try {
      const result = await ScreenRecorderModule.processVideo(videoPath, kept, null);
      hasEditedRef.current = true;
      setVideoPath(result); setEditMode(false); setProcessing(false);
      saveRecording(result);
      Alert.alert('Done', 'Video edited');
    } catch (e: any) { setProcessing(false); Alert.alert('Error', e?.message || 'Failed'); }
  };

  const uploadToCloud = async () => {
    if (!videoPath) return;
    setUploading(true);
    try {
      const url = await ScreenRecorderModule.uploadToCloud(videoPath);
      const title = videoPath.split('/').pop() || 'clip';
      const source = hasEditedRef.current ? 'edited' : 'recorded';
      await saveClipToConvex(url, title, source, duration > 0 ? duration : undefined);
      setUploading(false);
      Alert.alert('Uploaded', url);
    } catch (e: any) { setUploading(false); Alert.alert('Failed', e?.message || ''); }
  };

  const [sendingForEdit, setSendingForEdit] = useState(false);

  const sendForAIEdit = async () => {
    if (!videoPath) return;
    setSendingForEdit(true);
    try {
      // 1. Upload video to cloud
      const url = await ScreenRecorderModule.uploadToCloud(videoPath);
      const title = videoPath.split('/').pop() || 'clip';
      
      // 2. Create clip in Convex
      const clipResponse = await fetch(`${CONVEX_URL}/api/mutation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'clips:create',
          args: { 
            title, 
            url, 
            source: 'recorded',
            duration: duration > 0 ? duration : undefined,
          },
        }),
      });
      const clipData = await clipResponse.json();
      const clipId = clipData.value;
      
      // 3. Create edit request in Convex
      await fetch(`${CONVEX_URL}/api/mutation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'edits:create',
          args: { 
            clipId,
            prompt: 'Awaiting AI edit instructions',
            status: 'pending',
          },
        }),
      });
      
      setSendingForEdit(false);
      Alert.alert('Sent!', 'Video sent to Edits tab. Check the Edits tab to review when AI processing is complete.');
    } catch (e: any) { 
      setSendingForEdit(false); 
      Alert.alert('Failed', e?.message || 'Could not send for editing'); 
    }
  };

  // ========== SCREENS ==========

  // HOME
  if (!videoPath) {
    return (
      <View style={[S.root, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={S.pad}>
          <Text style={S.title}>Screen Recorder</Text>
          <View style={S.statusCard}>
            <View style={[S.dot, { backgroundColor: isRecording ? '#ff4757' : '#2ed573' }]} />
            <Text style={S.statusText}>{isRecording ? 'Recording' : 'Ready'}</Text>
          </View>
          {isRecording && <Text style={S.hint}>Pull down notification and tap STOP</Text>}
          {!isRecording && (
            <>
              <TouchableOpacity style={S.recBtn} onPress={startRecording}>
                <View style={S.recDot} />
                <Text style={S.recText}>Start Recording</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.importBtn} onPress={async () => {
                try {
                  const path = await ScreenRecorderModule.pickVideo();
                  hasEditedRef.current = true;
                  setVideoPath(path);
                  saveRecording(path);
                } catch {}
              }}>
                <Text style={S.importText}>Import Video</Text>
              </TouchableOpacity>
            </>
          )}
          {!isRecording && recordings.length > 0 && (
            <View style={{ marginTop: 25 }}>
              <Text style={S.secTitle}>Past Recordings</Text>
              {recordings.map((rec, i) => (
                <TouchableOpacity key={i} style={S.recItem}
                  onPress={() => { hasEditedRef.current = true; setVideoPath(rec.path); }}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.recName} numberOfLines={1}>{rec.name}</Text>
                    <Text style={S.recDate}>{rec.date}</Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteRecording(rec.path)} style={S.recDelBtn}>
                    <Text style={S.recDelText}>X</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // EDIT MODE
  if (editMode) {
    return (
      <View style={[S.root, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={S.pad}>
          <View style={S.editHeader}>
            <Text style={S.editTitle}>Edit</Text>
            <TouchableOpacity onPress={() => setEditMode(false)}>
              <Text style={S.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Video preview */}
          <View style={S.editVideo}>
            <Video
              ref={videoRef}
              source={{ uri: `file://${videoPath}` }}
              style={S.video}
              controls={true}
              resizeMode="contain"
              paused={paused}
              rate={getPreviewSpeed()}
              progressUpdateInterval={80}
              onLoad={(d: any) => {
                setDuration(d.duration);
                if (segments.length === 1 && segments[0].end === 0)
                  setSegments([{ start: 0, end: d.duration, speed: 1, crop: { ...NO_CROP } }]);
              }}
              onProgress={handleProgress}
              onSeek={handleSeekComplete}
              onPlaybackStateChanged={handlePlaybackState}
            />
          </View>

          {/* FILMSTRIP — the main editing control */}
          {loadingThumbs ? (
            <View style={S.thumbLoading}><Text style={S.thumbLoadText}>Loading frames...</Text></View>
          ) : (
            <FilmstripTimeline
              thumbnails={thumbnails}
              duration={duration}
              segments={segments}
              curTime={curTime}
              lockStart={lockStart}
              lockEnd={lockEnd}
              onTapSplit={splitAtTime}
              onHandleDrag={handleHandleDrag}
              onSeek={seekTo}
            />
          )}

          {/* Controls row: Split + Lock buttons */}
          <View style={S.controlsRow}>
            <TouchableOpacity
              style={S.splitBtn}
              onPress={() => splitAtTime(curTimeRef.current)}
            >
              <Text style={S.splitBtnText}>SPLIT</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[S.lockBtn, lockStart !== null && S.lockBtnActive]}
              onPress={() => {
                const t = curTimeRef.current;
                setLockStart(t);
                lockStartRef.current = t;
              }}
            >
              <Text style={S.lockBtnText}>SET START</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[S.lockBtn, lockEnd !== null && S.lockBtnActive]}
              onPress={() => {
                const t = curTimeRef.current;
                setLockEnd(t);
                lockEndRef.current = t;
              }}
            >
              <Text style={S.lockBtnText}>SET END</Text>
            </TouchableOpacity>
          </View>

          {/* Lock info + play in range */}
          {(lockStart !== null || lockEnd !== null) && (
            <View style={S.lockInfoRow}>
              <Text style={S.lockInfoText}>
                Range: {lockStart !== null ? fmt(lockStart) : '---'} → {lockEnd !== null ? fmt(lockEnd) : '---'}
              </Text>
              {lockStart !== null && lockEnd !== null && (
                <TouchableOpacity
                  style={S.playRangeBtn}
                  onPress={playRange}
                >
                  <Text style={S.playRangeBtnText}>PLAY RANGE</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={S.clearLockBtn}
                onPress={() => {
                  setLockStart(null); setLockEnd(null);
                  lockStartRef.current = null; lockEndRef.current = null;
                }}
              >
                <Text style={S.clearLockText}>CLEAR</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={S.hintEdit}>Drag red line to scrub. SPLIT to add segments. SET START/END to lock preview range.</Text>

          {/* Segment cards — just speed + delete */}
          {segments.map((seg, i) => (
            <View key={`${i}-${seg.start.toFixed(2)}-${seg.end.toFixed(2)}`} style={[S.segCard, {
              borderLeftColor: seg.speed === 0 ? '#555' : SEG_COLORS[i % SEG_COLORS.length],
              opacity: seg.speed === 0 ? 0.4 : 1,
              backgroundColor: '#16213e',
            }]}>
              <View style={S.segRow}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => seekTo(seg.start)}>
                  <Text style={S.segInfo}>
                    {fmt(seg.start)} — {fmt(seg.end)}  ({(seg.end - seg.start).toFixed(1)}s)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[S.delBtn, seg.speed === 0 && S.keepBtn]} onPress={() => toggleDelete(i)}>
                  <Text style={[S.delText, seg.speed === 0 && S.keepText]}>
                    {seg.speed === 0 ? 'KEEP' : 'DEL'}
                  </Text>
                </TouchableOpacity>
              </View>
              {seg.speed !== 0 && (
                <>
                  <View style={S.speedRow}>
                    <Text style={S.speedLabel}>Speed</Text>
                    <TextInput
                      style={S.speedInput}
                      value={seg.speed.toString()}
                      onChangeText={(v) => updateSpeed(i, v)}
                      keyboardType="decimal-pad"
                      placeholderTextColor="#666"
                    />
                    {[1, 2, 3, 4].map(sp => (
                      <TouchableOpacity key={sp}
                        style={[S.speedPreset, seg.speed === sp && S.speedPresetOn]}
                        onPress={() => updateSpeed(i, sp.toString())}>
                        <Text style={[S.speedPresetText, seg.speed === sp && S.speedPresetTextOn]}>{sp}x</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={S.cropRow}>
                    {([['Top', 'top'], ['Bot', 'bottom'], ['Left', 'left'], ['Right', 'right']] as [string, keyof Crop][]).map(([label, field]) => (
                      <View key={field} style={S.cropField}>
                        <Text style={S.cropLabel}>{label}</Text>
                        <TextInput
                          style={S.cropInput}
                          value={seg.crop[field]}
                          onChangeText={(v) => updateCrop(i, field, v)}
                          keyboardType="numeric"
                          placeholderTextColor="#666"
                          placeholder="0"
                        />
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          ))}

          {/* Apply */}
          <TouchableOpacity style={[S.applyBtn, processing && S.disabled]} onPress={applyEdits} disabled={processing}>
            <Text style={S.applyText}>{processing ? 'Processing...' : 'Apply All Changes'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // RESULT
  return (
    <View style={[S.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={S.pad}>
        <View style={S.editHeader}>
          <Text style={S.resultTitle}>Recording Ready</Text>
          <TouchableOpacity onPress={() => { hasEditedRef.current = false; setVideoPath(null); setEditMode(false); }}>
            <Text style={S.cancelText}>Home</Text>
          </TouchableOpacity>
        </View>
        <View style={S.previewBox}>
          <Video source={{ uri: `file://${videoPath}` }} style={S.video} controls={true} resizeMode="contain" paused={true} onLoad={(d: any) => setDuration(d.duration)} />
        </View>
        <TouchableOpacity style={S.bigBtn} onPress={enterEdit}><Text style={S.bigBtnText}>Edit Video</Text></TouchableOpacity>
        <View style={S.row}>
          <TouchableOpacity style={S.greenBtn} onPress={async () => { try { await ScreenRecorderModule.shareVideo(videoPath); } catch {} }}><Text style={S.greenBtnText}>Share</Text></TouchableOpacity>
          <TouchableOpacity style={S.greenBtn} onPress={async () => { try { const p = await ScreenRecorderModule.saveToDownloads(videoPath); Alert.alert('Saved', p); } catch {} }}><Text style={S.greenBtnText}>Save</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={[S.purpleBtn, uploading && S.disabled]} onPress={uploadToCloud} disabled={uploading}>
          <Text style={S.purpleBtnText}>{uploading ? 'Uploading...' : 'Upload to Cloud'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.aiEditBtn, sendingForEdit && S.disabled]} onPress={sendForAIEdit} disabled={sendingForEdit}>
          <Text style={S.aiEditBtnText}>{sendingForEdit ? 'Sending...' : '🤖 Send for AI Edit'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.ghostBtn} onPress={() => { hasEditedRef.current = false; setVideoPath(null); setEditMode(false); }}>
          <Text style={S.ghostText}>New Recording</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },
  pad: { padding: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 20 },
  statusCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, backgroundColor: '#16213e', marginBottom: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  statusText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  hint: { fontSize: 12, color: '#9e9e9e', textAlign: 'center', marginBottom: 20 },
  recBtn: { padding: 20, borderRadius: 12, backgroundColor: '#ff4757', alignItems: 'center', marginTop: 20 },
  recDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', marginBottom: 8 },
  recText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  importBtn: { padding: 16, borderRadius: 12, backgroundColor: '#0f3460', alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#70a1ff' },
  importText: { color: '#70a1ff', fontSize: 16, fontWeight: '700' },

  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  editTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  cancelText: { color: '#ff6b81', fontSize: 16, fontWeight: '600' },
  editVideo: { width: '100%', aspectRatio: 16 / 9, borderRadius: 8, overflow: 'hidden', marginBottom: 12, backgroundColor: '#000' },
  video: { width: '100%', height: '100%' },

  thumbLoading: { height: 80, justifyContent: 'center', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 8, marginBottom: 8 },
  thumbLoadText: { color: '#9e9e9e', fontSize: 13 },
  controlsRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  splitBtn: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: '#e84393', alignItems: 'center' },
  splitBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  lockBtn: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: '#2d3436', alignItems: 'center', borderWidth: 1, borderColor: '#555' },
  lockBtnActive: { backgroundColor: '#2d3436', borderColor: '#ffd700' },
  lockBtnText: { color: '#ffd700', fontSize: 12, fontWeight: '700' },
  lockInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, paddingHorizontal: 4 },
  lockInfoText: { color: '#ffd700', fontSize: 12, fontVariant: ['tabular-nums'] as any, flex: 1 },
  playRangeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#00b894' },
  playRangeBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  clearLockBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#2d3436', borderWidth: 1, borderColor: '#555' },
  clearLockText: { color: '#999', fontSize: 11, fontWeight: '600' },
  hintEdit: { color: '#555', fontSize: 11, textAlign: 'center', marginBottom: 12 },

  segCard: { borderLeftWidth: 5, backgroundColor: '#16213e', borderRadius: 10, padding: 10, marginBottom: 6 },
  segRow: { flexDirection: 'row', alignItems: 'center' },
  segInfo: { color: '#fff', fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] as any },
  delBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#ff6b81' },
  keepBtn: { borderColor: '#2ed573' },
  delText: { color: '#ff6b81', fontSize: 12, fontWeight: '700' },
  keepText: { color: '#2ed573' },
  speedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  speedLabel: { color: '#9e9e9e', fontSize: 13 },
  speedInput: { backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 16, fontWeight: 'bold', borderWidth: 1, borderColor: '#333', textAlign: 'center', width: 50 },
  speedPreset: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#333' },
  speedPresetOn: { backgroundColor: '#0f3460', borderColor: '#70a1ff' },
  speedPresetText: { color: '#9e9e9e', fontSize: 13, fontWeight: '600' },
  speedPresetTextOn: { color: '#fff' },

  secTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 10, marginBottom: 6 },
  cropRow: { flexDirection: 'row', gap: 8, marginBottom: 15 },
  cropField: { flex: 1 },
  cropLabel: { color: '#9e9e9e', fontSize: 11, marginBottom: 3, textAlign: 'center' },
  cropInput: { backgroundColor: '#16213e', color: '#fff', borderRadius: 8, padding: 8, fontSize: 15, borderWidth: 1, borderColor: '#333', textAlign: 'center' },

  applyBtn: { padding: 16, borderRadius: 12, backgroundColor: '#00b894', alignItems: 'center', marginBottom: 20 },
  applyText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.5 },

  resultTitle: { fontSize: 20, fontWeight: '600', color: '#2ed573', marginBottom: 12 },
  previewBox: { width: '100%', aspectRatio: 9 / 16, borderRadius: 8, overflow: 'hidden', marginBottom: 15, backgroundColor: '#000' },
  bigBtn: { padding: 16, borderRadius: 12, backgroundColor: '#0f3460', alignItems: 'center', marginBottom: 10 },
  bigBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  greenBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#2ed573', alignItems: 'center' },
  greenBtnText: { color: '#1a1a2e', fontSize: 15, fontWeight: '600' },
  purpleBtn: { padding: 15, borderRadius: 12, backgroundColor: '#6c5ce7', alignItems: 'center', marginBottom: 10 },
  purpleBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  aiEditBtn: { padding: 16, borderRadius: 12, backgroundColor: '#e84393', alignItems: 'center', marginBottom: 10, borderWidth: 2, borderColor: '#fd79a8' },
  aiEditBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  ghostBtn: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#555', alignItems: 'center' },
  ghostText: { color: '#9e9e9e', fontSize: 14 },

  recItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 10, padding: 12, marginBottom: 8 },
  recName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  recDate: { color: '#9e9e9e', fontSize: 12, marginTop: 2 },
  recDelBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#1a1a2e' },
  recDelText: { color: '#ff6b81', fontSize: 14, fontWeight: 'bold' },
});

export default App;
