# Quick Reference Card

## One-Line Setup

```bash
npm install && npm run android
```

## Essential Commands

| Command | Description |
|---------|-------------|
| `npm run android` | Install and run app on device |
| `npm run android:clean` | Clean build and run |
| `npm run log` | View app logs |
| `npm run devices` | List connected devices |
| `npm run android:release` | Build release APK |

## File Locations

**Recordings**: `/sdcard/Movies/ScreenRecorderApp/`
**APK**: `android/app/build/outputs/apk/release/app-release.apk`

## Quick Fixes

### App won't start
```bash
npm run android:clean
```

### Permission errors
```bash
adb shell pm grant com.screenrecorderapp android.permission.RECORD_AUDIO
```

### Retrieve recordings
```bash
adb pull /sdcard/Movies/ ./recordings/
```

### Uninstall
```bash
adb uninstall com.screenrecorderapp
```

## Recording Modes

**Full Screen**: Records entire screen including notifications
**Single App**: Records only the current app

## Default Settings

- **FPS**: 60 (up to 120 on One UI 6.0+)
- **Audio**: Enabled
- **Quality**: High
- **Format**: MP4

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No audio | Grant microphone permission |
| Won't record | Grant screen recording permission |
| App crashes | Run `npm run android:clean` |
| Storage full | Clear space, need 1GB minimum |

## Key Permissions

- Record Audio ✅
- Storage Access ✅
- Screen Recording ✅
- Foreground Service ✅

## Support

- **Logs**: `npm run log`
- **Device**: `adb devices`
- **Reinstall**: `adb uninstall com.screenrecorderapp && npm run android`
