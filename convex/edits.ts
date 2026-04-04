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
