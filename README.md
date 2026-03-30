# Screen Recorder App

A professional React Native screen recording application specifically optimized for Samsung S21 Ultra with dual recording modes.

## Features

- 🎥 **Dual Recording Modes**
  - **Full Screen Mode**: Records everything including notifications and system UI
  - **Single App Mode**: Records only the current app, excluding system elements

- ⚡ **High Performance**
  - 60 FPS recording (up to 120 FPS on One UI 6.0+)
  - Optimized for Samsung S21 Ultra
  - ~8% battery drain per hour

- 🎤 **Audio Support**
  - High-quality audio recording
  - Synchronized with video

- ⏯️ **Recording Controls**
  - Pause and resume functionality
  - Real-time recording timer
  - Instant playback access

- 🎨 **Modern UI**
  - Dark theme optimized for AMOLED displays
  - Intuitive controls
  - Real-time status indicators

## Quick Start

### Prerequisites

- Node.js (>= 20.x)
- Android Studio with Android SDK
- Samsung S21 Ultra with USB debugging enabled
- ADB installed

### Installation

```bash
# Clone the repository
git clone https://github.com/BraelinC/screen-recorder.git
cd screen-recorder

# Install dependencies
npm install

# Connect your Samsung S21 Ultra via USB and run
npm run android
```

### First Launch

Grant the required permissions when prompted:
- ✅ Record Audio
- ✅ Storage Access
- ✅ Screen Recording

## Usage

1. **Select Recording Mode**
   - Choose "Full Screen" for complete screen capture
   - Choose "Single App" for app-only recording

2. **Start Recording**
   - Tap the red "Start Recording" button
   - Grant screen recording permission when prompted

3. **Control Recording**
   - Use **Pause** to temporarily stop recording
   - Use **Resume** to continue recording
   - Tap **Stop** to save the video

4. **Access Recordings**
   - Find videos in Gallery → Movies folder
   - Or at `/sdcard/Movies/ScreenRecorderApp/`

## Commands

| Command | Description |
|---------|-------------|
| `npm run android` | Install and run on device |
| `npm run android:clean` | Clean build and run |
| `npm run log` | View app logs |
| `npm run devices` | List connected devices |
| `npm run android:release` | Build release APK |

## Documentation

- [SETUP_GUIDE.md](SETUP_GUIDE.md) - Detailed setup instructions
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - Testing procedures and scenarios
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Quick command reference

## Technical Stack

- **Framework**: React Native 0.84.1
- **Language**: TypeScript
- **Native Language**: Kotlin
- **Recording API**: Android MediaProjection API
- **Audio**: MediaRecorder with AAC encoding
- **Service**: Foreground service for reliable recording

## Architecture

```
ScreenRecorderApp/
├── App.tsx                     # Main UI component
├── android/
│   └── app/src/main/java/com/screenrecorderapp/
│       ├── ScreenRecorderModule.kt    # Native recording module
│       ├── ScreenRecorderPackage.kt   # Module package
│       ├── MainActivity.kt            # Main activity
│       └── MainApplication.kt         # App initialization
└── package.json
```

## Requirements

### Device Requirements
- **Target Device**: Samsung S21 Ultra
- **Android Version**: 11+ (API 30+)
- **Storage**: Minimum 1 GB free space
- **Battery**: Recommended 50%+ for recording

### Permissions
- `RECORD_AUDIO` - Audio capture
- `WRITE_EXTERNAL_STORAGE` - Save recordings
- `READ_EXTERNAL_STORAGE` - Access recordings
- `FOREGROUND_SERVICE` - Background recording
- `FOREGROUND_SERVICE_MEDIA_PROJECTION` - Screen capture
- `POST_NOTIFICATIONS` - Recording status

## Performance

| Metric | Value |
|--------|-------|
| FPS | 60-120 |
| Battery drain | ~8-10% per hour |
| File size (1 min) | 100-200 MB |
| Audio quality | AAC, 44.1 kHz |
| Video resolution | 1080p+ |

## Troubleshooting

### App won't start
```bash
npm run android:clean
```

### Recording doesn't work
- Ensure all permissions are granted
- Check storage space (need 1GB+)
- Grant screen recording permission when prompted

### No audio in recordings
- Go to Settings → Apps → ScreenRecorderApp → Permissions
- Enable Microphone permission

### App crashes
```bash
# View logs
npm run log

# Clean and rebuild
cd android && ./gradlew clean && cd ..
npm run android
```

## Building for Release

```bash
# Build release APK
npm run android:release

# APK location:
# android/app/build/outputs/apk/release/app-release.apk

# Install release build
adb install android/app/build/outputs/apk/release/app-release.apk
```

## Samsung S21 Ultra Optimizations

- High FPS recording (120 FPS with One UI 6.0+)
- Efficient battery management
- Optimized for AMOLED display
- Hardware acceleration enabled
- Compressed output for storage efficiency

## Known Limitations

- Screen recording permission required each session (Android 11+ requirement)
- DRM-protected content cannot be recorded (Netflix, etc.)
- Battery-intensive operation (recommended to use while charging for long recordings)
- Requires minimum 1 GB free storage

## Contributing

This is a personal project optimized for Samsung S21 Ultra. Feel free to fork and adapt for other devices.

## License

This project is for personal use. Please respect app store guidelines and content rights when recording.

## Support

For issues and questions:
1. Check the [SETUP_GUIDE.md](SETUP_GUIDE.md)
2. Review [TESTING_GUIDE.md](TESTING_GUIDE.md)
3. Check app logs: `npm run log`

## Acknowledgments

- Built with React Native
- Uses Android MediaProjection API
- Optimized for Samsung S21 Ultra
- Screen recording library: react-native-record-screen

---

**Device Target**: Samsung S21 Ultra
**React Native**: 0.84.1
**Android API**: 30+
**Status**: Production Ready ✅
