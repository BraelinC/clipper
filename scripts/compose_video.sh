#!/bin/bash
# compose_video.sh — Compose HeyGen avatar hook + main video with ElevenLabs voiceover
# Usage: ./compose_video.sh <avatar_video> <main_video> <voiceover_audio> <output>
#
# All audio normalized to 44100Hz mono AAC before concat.
# Avatar keeps its own audio, main video gets voiceover replacing original audio.

set -e

AVATAR="$1"
MAIN_VIDEO="$2"
VOICEOVER="$3"
OUTPUT="${4:-/tmp/composed_output.mp4}"

if [ -z "$AVATAR" ] || [ -z "$MAIN_VIDEO" ] || [ -z "$VOICEOVER" ]; then
  echo "Usage: $0 <avatar_video> <main_video> <voiceover_audio> [output_path]"
  exit 1
fi

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Get main video dimensions
DIMS=$(ffprobe -v quiet -show_entries stream=width,height -of csv=p=0 "$MAIN_VIDEO" | head -1)
W=$(echo "$DIMS" | cut -d, -f1)
H=$(echo "$DIMS" | cut -d, -f2)
echo "Main video: ${W}x${H}"

# Part 1: Scale avatar to match main video, normalize audio to 44100Hz mono
echo "Processing avatar hook..."
ffmpeg -i "$AVATAR" \
  -vf "scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black" \
  -c:v libx264 -preset fast -crf 18 -r 30 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -ar 44100 -ac 1 \
  -y "$TMPDIR/p1.mp4" 2>/dev/null

# Part 2: Main video + voiceover (de-essed), normalize audio
echo "Processing main video with voiceover..."
ffmpeg -i "$MAIN_VIDEO" -i "$VOICEOVER" \
  -map 0:v -map 1:a \
  -af "adeclick,highpass=f=80,bandreject=f=7500:w=2000,treble=g=-3:f=6000" \
  -c:v libx264 -preset fast -crf 18 -r 30 -pix_fmt yuv420p \
  -vf "scale=${W}:${H}" \
  -c:a aac -b:a 128k -ar 44100 -ac 1 \
  -y "$TMPDIR/p2.mp4" 2>/dev/null

# Concat
echo "file '$TMPDIR/p1.mp4'" > "$TMPDIR/concat.txt"
echo "file '$TMPDIR/p2.mp4'" >> "$TMPDIR/concat.txt"

echo "Joining..."
ffmpeg -f concat -safe 0 -i "$TMPDIR/concat.txt" \
  -c copy -movflags +faststart \
  -y "$OUTPUT" 2>/dev/null

DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUTPUT")
echo "Done! ${DUR}s → $OUTPUT"
