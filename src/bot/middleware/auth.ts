import type { Context, NextFunction } from "grammy";
import { isAuthorized } from "../../services/auth-store.js";
import { logger } from "../../utils/logger.js";

const AUTH_COMMANDS = new Set(["auth", "start"]);

export async function authMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (isAuthorized(userId)) {
    await next();
    return;
  }

  const command = ctx.message && "text" in ctx.message
    ? ctx.message.text?.split(" ")[0]?.replace("/", "")
    : undefined;

  if (command && AUTH_COMMANDS.has(command)) {
    await next();
    return;
  }

  logger.warn("Unauthorized access attempt", {
    userId,
    username: ctx.from?.username,
  });
  await ctx.reply("⛔ Non sei autorizzato. Usa /auth <PIN> per autenticarti.");
}
