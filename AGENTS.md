# Clipper App Enhancement - AI Edit Review

## Task
Add a second screen/tab to the existing Clipper React Native app for reviewing AI-edited videos.

## Convex Backend
- Deployment: wary-panther-105
- Already has clips table from the existing app

## New Screen Requirements

### "Edits" Tab
1. Show list of clips that have been edited by AI (status: "edited")
2. Each item shows:
   - Thumbnail
   - Original title
   - Edit prompt that was used
   - Status badge (pending/approved/rejected)

### Edit Review View
1. Video player showing the AI-edited version
2. Original prompt displayed
3. Two buttons:
   - ✅ Approve → marks approved, ready for Instagram
   - ❌ Reject → shows feedback input, sends back for re-edit
4. Optional: "Post to Instagram" button after approval

## Convex Schema to Add
Add to existing schema:
- edits table: clipId, prompt, status, outputUrl, error
- approvals table: editId, approved, feedback

## Implementation
1. Add new Convex functions (edits.ts, approvals.ts)
2. Add EditsScreen.tsx component
3. Add EditReviewView.tsx component  
4. Add tab navigation to switch between Record and Edits screens

## Existing App Structure
- App.tsx has the main UI
- Uses react-native-video for playback
- Already saves to Convex (formal-weasel-180)
- Switch to wary-panther-105 deployment
