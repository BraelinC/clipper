# Compose Video Skill

Create hook-style videos: HeyGen avatar intro + main video with ElevenLabs voiceover.

## Video Formula

1. **Hook** (1-3s) — HeyGen avatar says an attention-grabbing line with its own voice
2. **Body** (15-60s) — Main video content with ElevenLabs voiceover replacing original audio

## Pipeline

### Step 1: Generate the Hook (HeyGen Avatar)

Use HeyGen API to generate a short avatar video:

```bash
# List available avatars
curl -s -H "X-Api-Key: $HEYGEN_API_KEY" "https://api.heygen.com/v2/avatars" | python3 -m json.tool

# Generate avatar video
curl -X POST "https://api.heygen.com/v2/video/generate" \
  -H "X-Api-Key: $HEYGEN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "video_inputs": [{
      "character": {
        "type": "avatar",
        "avatar_id": "<AVATAR_ID>",
        "avatar_style": "normal"
      },
      "voice": {
        "type": "text",
        "input_text": "<HOOK_TEXT>",
        "voice_id": "<VOICE_ID>"
      }
    }],
    "dimension": { "width": 1080, "height": 1920 }
  }'

# Poll for completion
curl -s -H "X-Api-Key: $HEYGEN_API_KEY" "https://api.heygen.com/v1/video_status.get?video_id=<VIDEO_ID>"

# Or use past generations
curl -s -H "X-Api-Key: $HEYGEN_API_KEY" "https://api.heygen.com/v1/video.list?limit=20"
```

### Step 2: Generate the Voiceover (ElevenLabs)

Generate voiceover audio for the body script using ElevenLabs API or download from elevenlabs.io.

### Step 3: Compose

```bash
./scripts/compose_video.sh <avatar.mp4> <main_video.mp4> <voiceover.mp3> <output.mp4>
```

### Step 4: Upload to R2

```bash
aws s3 cp output.mp4 s3://apk-builds/screen-recorder/clips/<filename>.mp4 \
  --endpoint-url https://e916ecaf8740e573530fbc483d04c7c1.r2.cloudflarestorage.com
```

Public URL: `https://pub-8d9a562c03ac408b89163036650efc98.r2.dev/screen-recorder/clips/<filename>.mp4`

## Critical: Audio Normalization

Both parts MUST have matching audio format before concat:
- **Sample rate**: 44100Hz
- **Channels**: mono (1)
- **Codec**: AAC

Mismatch causes: no audio, crackling, or player errors. The compose script handles this automatically.

## De-essing

ElevenLabs voices can have harsh sibilance ("ssss"). The compose script applies:
- `adeclick` — remove clicks
- `highpass=f=80` — remove rumble
- `bandreject=f=7500:w=2000` — reduce sibilance
- `treble=g=-3:f=6000` — soften highs

## API Keys

- **HeyGen**: Set `HEYGEN_API_KEY` env var
- **ElevenLabs**: Generate at elevenlabs.io or use API
- **R2**: Access key `dcc1b5bafad748c86bcc27efb81ee5ea`

## Convex Integration

After uploading, save clip metadata:
```bash
curl -X POST "https://formal-weasel-180.convex.cloud/api/mutation" \
  -H "Content-Type: application/json" \
  -d '{"path":"clips:create","args":{"title":"<title>","url":"<r2_url>","source":"edited"}}'
```
