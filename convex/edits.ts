import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List all edits with their approval status
export const list = query({
  args: {},
  handler: async (ctx) => {
    const edits = await ctx.db.query("edits").order("desc").collect();

    // Fetch clip and approval info for each edit
    const editsWithDetails = await Promise.all(
      edits.map(async (edit) => {
        const clip = await ctx.db.get(edit.clipId);
        const approval = await ctx.db
          .query("approvals")
          .withIndex("by_edit", (q) => q.eq("editId", edit._id))
          .first();

        return {
          ...edit,
          clipTitle: clip?.title ?? "Unknown",
          clipUrl: clip?.url,
          approval: approval
            ? { approved: approval.approved, feedback: approval.feedback }
            : null,
        };
      })
    );

    return editsWithDetails;
  },
});

// Get a single edit with full details
export const get = query({
  args: { editId: v.id("edits") },
  handler: async (ctx, args) => {
    const edit = await ctx.db.get(args.editId);
    if (!edit) return null;

    const clip = await ctx.db.get(edit.clipId);
    const approval = await ctx.db
      .query("approvals")
      .withIndex("by_edit", (q) => q.eq("editId", args.editId))
      .first();

    return {
      ...edit,
      clipTitle: clip?.title ?? "Unknown",
      clipUrl: clip?.url,
      approval: approval
        ? { approved: approval.approved, feedback: approval.feedback }
        : null,
    };
  },
});

// Create a new edit (called when AI processing starts)
export const create = mutation({
  args: {
    clipId: v.id("clips"),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("edits", {
      clipId: args.clipId,
      prompt: args.prompt,
      status: "pending",
    });
  },
});

// Update edit status (called by processing pipeline)
export const updateStatus = mutation({
  args: {
    editId: v.id("edits"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    outputUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { editId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(editId, filteredUpdates);
  },
});

// Set thinking state (AI is processing)
export const setThinking = mutation({
  args: {
    editId: v.id("edits"),
    thinking: v.boolean(),
    silasConversationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.editId, {
      thinking: args.thinking,
      silasConversationId: args.silasConversationId,
      // Clear streaming when starting to think
      ...(args.thinking ? { streaming: false, streamingContent: "" } : {}),
    });
  },
});

// Update streaming content (real-time response)
export const updateStreaming = mutation({
  args: {
    editId: v.id("edits"),
    streaming: v.boolean(),
    streamingContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.editId, {
      streaming: args.streaming,
      streamingContent: args.streamingContent ?? "",
      // Turn off thinking when streaming starts
      ...(args.streaming ? { thinking: false } : {}),
    });
  },
});

// Clear streaming state (response complete)
export const clearStreaming = mutation({
  args: {
    editId: v.id("edits"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.editId, {
      thinking: false,
      streaming: false,
      streamingContent: "",
    });
  },
});
