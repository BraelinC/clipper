# Testing Guide - Samsung S21 Ultra

This guide will help you test the Screen Recorder app on your Samsung S21 Ultra device.

## Pre-Testing Checklist

### 1. Device Preparation

- [ ] Samsung S21 Ultra is charged (at least 50%)
- [ ] USB debugging is enabled
- [ ] Device is connected via USB cable
- [ ] ADB recognizes the device (`adb devices` shows your device)

### 2. Development Environment

- [ ] Node.js is installed (check: `node --version`)
- [ ] Android SDK is configured
- [ ] React Native CLI is working (`npx react-native --version`)
- [ ] All npm dependencies are installed (`npm install`)

## Quick Start Testing

### Step 1: Build and Install

```bash
# Clean build (recommended for first time)
npm run android:clean

# Or standard build
npm run android
```

The app should automatically install and launch on your Samsung S21 Ultra.

### Step 2: Grant Permissions

When the app launches:

1. **On first start**, tap "Start Recording"
2. Grant the following permissions when prompted:
   - ✅ Record Audio
   - ✅ Storage Access (Files and media)
   - ✅ Screen Recording (Android system dialog)

### Step 3: Test Full Screen Mode

1. Select **"Full Screen"** mode
2. Tap **"Start Recording"**
3. Grant screen recording permission in the Android dialog
4. The app will minimize, and you'll see a recording notification
5. Navigate around your phone (home screen, apps, notifications)
6. Return to the app
7. Tap **"Stop"**
8. Check that the video path is displayed

### Step 4: Test Single App Mode

1. Select **"Single App"** mode
2. Tap **"Start Recording"**
3. Use the app features while recording
4. Tap **"Pause"** to test pause functionality
5. Tap **"Resume"** to continue
6. Tap **"Stop"** to end recording

### Step 5: Verify Recordings

#### Option A: Using Device Gallery
1. Open the **Gallery** app on your Samsung S21 Ultra
2. Navigate to **Albums** → **Screen recordings** or **Movies**
3. Play the recorded videos

#### Option B: Using ADB
```bash
# List recorded files
adb shell ls -la /sdcard/Movies/

# Pull a specific recording to your computer
adb pull /sdcard/Movies/screen_recording_*.mp4 ./recordings/
```

## Testing Scenarios

### Scenario 1: Basic Recording Test

**Objective**: Verify basic recording functionality

1. Start recording in Full Screen mode
2. Record for 30 seconds
3. Stop recording
4. Verify video is saved and playable

**Expected Result**: ✅ Video plays smoothly with audio

---

### Scenario 2: Pause/Resume Test

**Objective**: Test pause and resume functionality

1. Start recording in Single App mode
2. Record for 10 seconds
3. Pause recording
4. Wait 5 seconds
5. Resume recording
6. Record for 10 more seconds
7. Stop recording

**Expected Result**: ✅ Final video has ~20 seconds of content (paused time excluded)

---

### Scenario 3: Mode Switching Test

**Objective**: Verify both recording modes work

1. Record 15 seconds in Full Screen mode → Stop
2. Switch to Single App mode
3. Record 15 seconds in Single App mode → Stop
4. Compare both videos

**Expected Result**:
- ✅ Full Screen video shows system UI, notifications
- ✅ Single App video focuses on app content

---

### Scenario 4: Long Recording Test

**Objective**: Test stability for extended recording

1. Start recording in Full Screen mode
2. Record for 5 minutes while using the device normally
3. Stop recording

**Expected Result**:
- ✅ App doesn't crash
- ✅ Video file size is ~500-1000 MB
- ✅ Battery drain is reasonable (~8-10%)

---

### Scenario 5: Permission Denial Test

**Objective**: Handle permission denial gracefully

1. Start recording
2. When Android prompts for screen recording permission, tap **"Cancel"**

**Expected Result**: ✅ App shows error message, doesn't crash

---

### Scenario 6: Audio Recording Test

**Objective**: Verify audio capture

1. Start recording
2. Play music or speak near the device
3. Stop recording
4. Play back the video

**Expected Result**: ✅ Audio is clear and synchronized with video

## Samsung S21 Ultra Specific Tests

### High FPS Test (One UI 6.0+)

**Check One UI version**:
```
Settings → About phone → Software information → One UI version
```

If you have **One UI 6.0 or higher**:

1. The app should utilize 120 FPS capability
2. Record fast-moving content (scroll quickly, play games)
3. Playback should be smooth without stuttering

### Battery Optimization Test

1. Note battery percentage before starting
2. Record for exactly 1 hour
3. Note battery percentage after stopping
4. Calculate drain

**Expected Result**: ✅ ~8-10% battery drain per hour

### Storage Space Test

1. Check available storage: `Settings → Storage`
2. Record a 1-minute video
3. Check the file size

**Expected Result**:
- ✅ 60 FPS recording: ~100-200 MB per minute
- ✅ File is properly compressed

## Troubleshooting Test Failures

### App crashes immediately
```bash
# Check logs
npx react-native log-android

# Or
adb logcat *:S ReactNative:V ReactNativeJS:V
```

Look for errors related to:
- Missing permissions in AndroidManifest.xml
- Native module not found
- Gradle build issues

**Fix**: Clean and rebuild
```bash
cd android
./gradlew clean
cd ..
npx react-native run-android
```

---

### Recording doesn't start

**Check**:
1. Permissions granted? (`Settings → Apps → ScreenRecorderApp → Permissions`)
2. Storage space available? (Need at least 1 GB free)
3. ADB logs show any errors?

**Fix**:
```bash
# Manually grant all permissions
adb shell pm grant com.screenrecorderapp android.permission.RECORD_AUDIO
adb shell pm grant com.screenrecorderapp android.permission.WRITE_EXTERNAL_STORAGE
adb shell pm grant com.screenrecorderapp android.permission.READ_EXTERNAL_STORAGE
```

---

### Video has no audio

**Check**:
1. Microphone permission granted?
2. Device is not muted
3. Another app isn't using microphone

**Fix**:
- Close other apps that might use microphone
- Revoke and re-grant microphone permission

---

### App won't install

**Error**: `INSTALL_FAILED_UPDATE_INCOMPATIBLE`

**Fix**:
```bash
# Uninstall existing version
adb uninstall com.screenrecorderapp

# Reinstall
npm run android
```

---

### Build fails

**Common Gradle errors**:

```bash
# Clear Gradle cache
cd android
./gradlew clean

# Clear node modules and reinstall
cd ..
rm -rf node_modules
npm install

# Rebuild
npm run android
```

## Performance Benchmarks (Samsung S21 Ultra)

Expected performance metrics:

| Metric | Expected Value |
|--------|---------------|
| FPS | 60-120 (depends on One UI version) |
| Battery drain | ~8-10% per hour |
| File size (1 min) | 100-200 MB |
| Max recording time | Limited by storage space |
| Audio quality | AAC, 44.1 kHz |
| Video resolution | 1080p or device native |

## Advanced Testing

### Test with React Native Debugger

1. Install React Native Debugger
2. Start the app in debug mode
3. Monitor state changes during recording
4. Check for memory leaks

### Performance Profiling

```bash
# Android profiler
adb shell am profile start com.screenrecorderapp

# Record for some time

adb shell am profile stop com.screenrecorderapp
```

### Network Logging

```bash
# Monitor all app activity
adb logcat | grep ScreenRecorderApp
```

## Release Build Testing

Before deploying, test the release build:

```bash
# Build release APK
npm run android:release

# Install release build
npm run android:install

# Or manually
adb install android/app/build/outputs/apk/release/app-release.apk
```

Test all scenarios above with the release build.

## Test Report Template

Use this template to document your testing:

```markdown
## Test Report - [Date]

**Device**: Samsung S21 Ultra
**Android Version**:
**One UI Version**:
**App Version**: 1.0

### Tests Performed

- [ ] Basic Recording (Full Screen)
- [ ] Basic Recording (Single App)
- [ ] Pause/Resume
- [ ] Audio Recording
- [ ] Long Duration (5+ min)
- [ ] Permission Handling
- [ ] Mode Switching

### Issues Found

1. [Issue description]
   - Severity: High/Medium/Low
   - Steps to reproduce:
   - Expected vs Actual:

### Performance

- Average FPS:
- Battery drain:
- File size (per minute):
- Crashes: Yes/No

### Conclusion

[Overall assessment and next steps]
```

## Automated Testing (Future)

Consider adding E2E tests using:
- Detox
- Appium
- Maestro

Example test case:
```typescript
// Example with Detox
describe('Screen Recording', () => {
  it('should start and stop recording', async () => {
    await element(by.text('Start Recording')).tap();
    await waitFor(element(by.text('Stop'))).toBeVisible().withTimeout(2000);
    await element(by.text('Stop')).tap();
    await expect(element(by.text('Last Recording'))).toBeVisible();
  });
});
```

## Conclusion

After completing all tests, your Screen Recorder app should:
- ✅ Record in both Full Screen and Single App modes
- ✅ Capture high-quality video (60-120 FPS)
- ✅ Include synchronized audio
- ✅ Handle pause/resume smoothly
- ✅ Save videos to accessible location
- ✅ Handle permissions correctly
- ✅ Perform efficiently on Samsung S21 Ultra

If all tests pass, the app is ready for use! 🎉
