import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Existing clips table (already exists in wary-panther-105)
  clips: defineTable({
    title: v.string(),
    url: v.string(),
    source: v.union(
      v.literal("recorded"),
      v.literal("uploaded"),
      v.literal("edited")
    ),
    duration: v.optional(v.number()),
    fileSize: v.optional(v.number()),
  }),

  // AI-generated edits of clips
  edits: defineTable({
    clipId: v.id("clips"),
    prompt: v.string(), // User's edit request (e.g., "add captions, cut intro")
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    outputUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_clip", ["clipId"])
    .index("by_status", ["status"]),

  // User approval/rejection of edits
  approvals: defineTable({
    editId: v.id("edits"),
    approved: v.boolean(),
    feedback: v.optional(v.string()),
    approvedAt: v.number(),
  }).index("by_edit", ["editId"]),
});
