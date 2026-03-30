import React, { useState, useEffect } from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import RecordScreen from 'react-native-record-screen';
import { NativeModules, NativeEventEmitter } from 'react-native';

const { ScreenRecorderModule } = NativeModules;

type RecordingMode = 'fullscreen' | 'singleapp';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('fullscreen');
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoPath, setVideoPath] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  useEffect(() => {
    const eventEmitter = new NativeEventEmitter(ScreenRecorderModule);

    const startedListener = eventEmitter.addListener('onRecordingStarted', (event) => {
      console.log('Recording started:', event);
    });

    const stoppedListener = eventEmitter.addListener('onRecordingStopped', (event) => {
      console.log('Recording stopped:', event);
    });

    const errorListener = eventEmitter.addListener('onRecordingError', (event) => {
      console.error('Recording error:', event);
      Alert.alert('Recording Error', event.error);
    });

    return () => {
      startedListener.remove();
      stoppedListener.remove();
      errorListener.remove();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ]);

        return Object.values(granted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const startRecording = async () => {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) {
      Alert.alert('Permissions Required', 'Please grant all permissions to record screen');
      return;
    }

    try {
      const res = await RecordScreen.startRecording({
        mic: true,
        fps: 60,
      });

      if (res === RecordScreen.RESULT_OK) {
        setIsRecording(true);
        setRecordingTime(0);
        setVideoPath(null);
        Alert.alert(
          'Recording Started',
          `Recording in ${recordingMode === 'fullscreen' ? 'Full Screen' : 'Single App'} mode`
        );
      }
    } catch (error) {
      console.error('Start recording error:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      const path = await RecordScreen.stopRecording();
      setIsRecording(false);
      setIsPaused(false);
      setVideoPath(path);
      Alert.alert('Recording Saved', `Video saved to: ${path}`);
    } catch (error) {
      console.error('Stop recording error:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const pauseRecording = async () => {
    try {
      await RecordScreen.pauseRecording();
      setIsPaused(true);
    } catch (error) {
      console.error('Pause recording error:', error);
      Alert.alert('Error', 'Failed to pause recording');
    }
  };

  const resumeRecording = async () => {
    try {
      await RecordScreen.resumeRecording();
      setIsPaused(false);
    } catch (error) {
      console.error('Resume recording error:', error);
      Alert.alert('Error', 'Failed to resume recording');
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Screen Recorder</Text>
          <Text style={styles.subtitle}>Samsung S21 Ultra Edition</Text>
        </View>

        <View style={styles.modeSelector}>
          <Text style={styles.sectionTitle}>Recording Mode</Text>
          <View style={styles.modeButtons}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                recordingMode === 'fullscreen' && styles.modeButtonActive,
              ]}
              onPress={() => !isRecording && setRecordingMode('fullscreen')}
              disabled={isRecording}>
              <Text
                style={[
                  styles.modeButtonText,
                  recordingMode === 'fullscreen' && styles.modeButtonTextActive,
                ]}>
                Full Screen
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                recordingMode === 'singleapp' && styles.modeButtonActive,
              ]}
              onPress={() => !isRecording && setRecordingMode('singleapp')}
              disabled={isRecording}>
              <Text
                style={[
                  styles.modeButtonText,
                  recordingMode === 'singleapp' && styles.modeButtonTextActive,
                ]}>
                Single App
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modeDescription}>
            {recordingMode === 'fullscreen'
              ? 'Records everything on your screen including notifications and navigation'
              : 'Records only the current app, excluding system UI and notifications'}
          </Text>
        </View>

        <View style={styles.statusContainer}>
          <View style={styles.statusCard}>
            <View style={[styles.statusDot, { backgroundColor: isRecording ? '#ff4757' : '#2ed573' }]} />
            <Text style={styles.statusText}>
              {isRecording ? (isPaused ? 'Paused' : 'Recording') : 'Ready'}
            </Text>
          </View>
          {isRecording && (
            <View style={styles.timerCard}>
              <Text style={styles.timerText}>{formatTime(recordingTime)}</Text>
            </View>
          )}
        </View>

        <View style={styles.controls}>
          {!isRecording ? (
            <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
              <View style={styles.recordButtonInner} />
              <Text style={styles.recordButtonText}>Start Recording</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.controlButton} onPress={stopRecording}>
                <View style={styles.stopIcon} />
                <Text style={styles.controlButtonText}>Stop</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={isPaused ? resumeRecording : pauseRecording}>
                <Text style={styles.pauseIcon}>{isPaused ? '▶' : '❚❚'}</Text>
                <Text style={styles.controlButtonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {videoPath && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>Last Recording</Text>
            <Text style={styles.resultPath}>{videoPath}</Text>
          </View>
        )}

        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Features</Text>
          <Text style={styles.infoText}>• High quality 60 FPS recording</Text>
          <Text style={styles.infoText}>• Audio recording support</Text>
          <Text style={styles.infoText}>• Pause and resume functionality</Text>
          <Text style={styles.infoText}>• Optimized for Samsung S21 Ultra</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#9e9e9e',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
  },
  modeSelector: {
    marginBottom: 30,
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  modeButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#16213e',
    borderWidth: 2,
    borderColor: '#16213e',
    alignItems: 'center',
  },
  modeButtonActive: {
    borderColor: '#0f3460',
    backgroundColor: '#0f3460',
  },
  modeButtonText: {
    color: '#9e9e9e',
    fontSize: 16,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  modeDescription: {
    fontSize: 12,
    color: '#9e9e9e',
    lineHeight: 18,
  },
  statusContainer: {
    marginBottom: 30,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#16213e',
    marginBottom: 10,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  timerCard: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#0f3460',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'monospace',
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 30,
  },
  recordButton: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#ff4757',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  controlButton: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#16213e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIcon: {
    width: 20,
    height: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  pauseIcon: {
    fontSize: 20,
    color: '#fff',
    marginBottom: 10,
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#16213e',
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  resultPath: {
    fontSize: 12,
    color: '#9e9e9e',
    fontFamily: 'monospace',
  },
  infoContainer: {
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#16213e',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#9e9e9e',
    marginBottom: 5,
  },
});

export default App;
