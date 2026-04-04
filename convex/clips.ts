import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a clip (existing functionality, now as Convex function)
export const create = mutation({
  args: {
    title: v.string(),
    url: v.string(),
    source: v.union(
      v.literal("recorded"),
      v.literal("uploaded"),
      v.literal("edited")
    ),
    duration: v.optional(v.number()),
    fileSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("clips", args);
  },
});

// List all clips
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("clips").order("desc").collect();
  },
});

// Get a single clip
export const get = query({
  args: { clipId: v.id("clips") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.clipId);
  },
});
