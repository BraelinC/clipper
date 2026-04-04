import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all messages for an edit
export const list = query({
  args: { editId: v.id("edits") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("editMessages")
      .withIndex("by_edit", (q) => q.eq("editId", args.editId))
      .collect();
  },
});

// Send a user message
export const send = mutation({
  args: {
    editId: v.id("edits"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("editMessages", {
      editId: args.editId,
      role: "user",
      content: args.content,
    });
  },
});

// Send an assistant response (called by Silas)
export const respond = mutation({
  args: {
    editId: v.id("edits"),
    content: v.string(),
    videoUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("editMessages", {
      editId: args.editId,
      role: "assistant",
      content: args.content,
      videoUrl: args.videoUrl,
      thumbnailUrl: args.thumbnailUrl,
    });
  },
});
