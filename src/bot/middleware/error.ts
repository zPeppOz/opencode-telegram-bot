import type { Context, NextFunction } from "grammy";
import { logger } from "../../utils/logger.js";

export async function errorMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  try {
    await next();
  } catch (err) {
    logger.error("Unhandled error in handler", {
      error: String(err),
      update: JSON.stringify(ctx.update).slice(0, 200),
    });
    try {
      await ctx.reply("❌ Something went wrong. Please try again.");
    } catch {
      // can't even reply
    }
  }
}
