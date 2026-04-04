import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get approval for an edit
export const getByEdit = query({
  args: { editId: v.id("edits") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("approvals")
      .withIndex("by_edit", (q) => q.eq("editId", args.editId))
      .first();
  },
});

// Approve an edit
export const approve = mutation({
  args: {
    editId: v.id("edits"),
    feedback: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const edit = await ctx.db.get(args.editId);
    if (!edit) throw new Error("Edit not found");
    if (edit.status !== "completed") {
      throw new Error("Can only approve completed edits");
    }

    // Check for existing approval
    const existing = await ctx.db
      .query("approvals")
      .withIndex("by_edit", (q) => q.eq("editId", args.editId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        approved: true,
        feedback: args.feedback,
        approvedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("approvals", {
      editId: args.editId,
      approved: true,
      feedback: args.feedback,
      approvedAt: Date.now(),
    });
  },
});

// Reject an edit
export const reject = mutation({
  args: {
    editId: v.id("edits"),
    feedback: v.string(),
  },
  handler: async (ctx, args) => {
    const edit = await ctx.db.get(args.editId);
    if (!edit) throw new Error("Edit not found");

    const existing = await ctx.db
      .query("approvals")
      .withIndex("by_edit", (q) => q.eq("editId", args.editId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        approved: false,
        feedback: args.feedback,
        approvedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("approvals", {
      editId: args.editId,
      approved: false,
      feedback: args.feedback,
      approvedAt: Date.now(),
    });
  },
});
