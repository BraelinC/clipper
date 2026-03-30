# Screen Recorder App - Setup Guide for Samsung S21 Ultra

A professional React Native screen recording application specifically optimized for Samsung S21 Ultra with two recording modes:
- **Full Screen Mode**: Records everything on your screen including notifications and system UI
- **Single App Mode**: Records only the current app, excluding system elements

## Features

- 🎥 High-quality 60 FPS recording
- 🎤 Audio recording support
- ⏸️ Pause and resume functionality
- 📱 Optimized for Samsung S21 Ultra (up to 120 FPS support with One UI 6.0+)
- 🎨 Modern, intuitive UI with dark theme
- 📊 Real-time recording timer
- 💾 Automatic video saving to device storage

## Prerequisites

1. **Node.js** (>= 22.11.0 recommended, but will work with 20.x)
2. **React Native development environment**:
   - Android Studio
   - Android SDK (API 21 or higher)
   - JDK 17+
3. **Samsung S21 Ultra** with USB debugging enabled
4. **ADB** (Android Debug Bridge) installed

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Android SDK

Make sure your Android SDK is properly configured:

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### 3. Connect Your Samsung S21 Ultra

Enable Developer Options on your device:
1. Go to Settings > About phone
2. Tap "Build number" 7 times
3. Go back to Settings > Developer options
4. Enable "USB debugging"
5. Connect your device via USB
6. Accept the USB debugging prompt on your device

Verify connection:
```bash
adb devices
```

You should see your device listed.

### 4. Install the App

```bash
npx react-native run-android
```

Or use the npm script:
```bash
npm run android
```

## Usage

### First Launch

When you first open the app, you'll need to grant the following permissions:
- **Record Audio**: For capturing audio during screen recording
- **Storage Access**: For saving recorded videos
- **Screen Recording Permission**: Android will prompt you when you start recording

### Recording Modes

#### Full Screen Mode
- Captures everything visible on your screen
- Includes notifications, navigation bar, and status bar
- Perfect for tutorials and demonstrations

#### Single App Mode
- Records only the active application
- Excludes system UI elements
- Ideal for app-specific recordings and cleaner output

### Controls

1. **Select Recording Mode**: Tap either "Full Screen" or "Single App" before starting
2. **Start Recording**: Press the red "Start Recording" button
3. **Pause/Resume**: Use the pause button during recording to temporarily stop
4. **Stop**: Press the stop button to end recording and save the video

### Recording Settings

The app is configured with optimal settings for Samsung S21 Ultra:
- **FPS**: 60 (supports up to 120 FPS on One UI 6.0+)
- **Audio**: Enabled by default
- **Quality**: High

## File Locations

Recorded videos are saved to:
```
/storage/emulated/0/Movies/ScreenRecorderApp/
```

You can access them through:
- Your device's Gallery app
- Files app under "Movies"
- Via ADB: `adb pull /sdcard/Movies/ScreenRecorderApp/`

## Troubleshooting

### App won't install
```bash
# Clean the build
cd android
./gradlew clean
cd ..
npx react-native run-android
```

### Permission errors
- Manually grant permissions in Settings > Apps > ScreenRecorderApp > Permissions

### Recording not working
1. Ensure you granted screen recording permission when prompted
2. Check storage space on your device
3. Restart the app

### Audio not recording
- Go to Settings > Apps > ScreenRecorderApp > Permissions
- Enable "Microphone" permission

### App crashes on start
```bash
# Rebuild the app
npm run android -- --reset-cache
```

## Building for Release

### Generate a signing key

```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore screenrecorder-release.keystore -alias screenrecorder -keyalg RSA -keysize 2048 -validity 10000
```

### Configure Gradle

Edit `android/gradle.properties` and add:
```properties
SCREENRECORDER_UPLOAD_STORE_FILE=screenrecorder-release.keystore
SCREENRECORDER_UPLOAD_KEY_ALIAS=screenrecorder
SCREENRECORDER_UPLOAD_STORE_PASSWORD=your_password
SCREENRECORDER_UPLOAD_KEY_PASSWORD=your_password
```

### Build the APK

```bash
cd android
./gradlew assembleRelease
```

The APK will be located at:
```
android/app/build/outputs/apk/release/app-release.apk
```

### Install release APK

```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

## Samsung S21 Ultra Specific Features

This app is optimized to take advantage of Samsung S21 Ultra capabilities:

- **High FPS Support**: Utilizes One UI 6.0's 120 FPS recording capability
- **Battery Optimization**: Efficient recording (~8% battery per hour)
- **Storage Management**: Compressed output for optimal storage usage
- **Audio Quality**: High-quality audio capture using Samsung's audio APIs

## Technical Details

### Architecture

- **Frontend**: React Native with TypeScript
- **Native Module**: Kotlin-based screen recorder module
- **Recording API**: Android MediaProjection API
- **Audio Capture**: MediaRecorder with AAC encoding
- **Service**: Foreground service for reliable recording

### Permissions Required

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### Dependencies

- `react-native`: ^0.84.1
- `react-native-record-screen`: ^1.0.0
- `react-native-safe-area-context`: (included)

## Development

### Running in Development Mode

```bash
# Start Metro bundler
npm start

# In another terminal, install on device
npm run android
```

### Debugging

```bash
# View logs
npx react-native log-android

# Or use ADB
adb logcat *:S ReactNative:V ReactNativeJS:V
```

### Hot Reload

- Press `r` in the Metro bundler terminal to reload
- Shake your device and select "Reload" from the developer menu

## Known Limitations

1. **Android 11+**: Screen recording requires user consent each time (Android security requirement)
2. **DRM Content**: Protected content (Netflix, etc.) cannot be recorded
3. **Battery Usage**: Recording is battery-intensive, use while charging for long recordings
4. **Storage**: HD recordings consume ~100-200 MB per minute

## Support

For issues and feature requests, please refer to:
- React Native documentation: https://reactnative.dev
- MediaProjection API: https://developer.android.com/reference/android/media/projection/MediaProjection
- Samsung Developer: https://developer.samsung.com

## License

This project is for personal use. Please respect app store guidelines and content rights when recording.
