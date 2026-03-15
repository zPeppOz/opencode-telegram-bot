import type { Context } from "grammy";
import { opencode } from "../../opencode/client.js";
import { getState, setState } from "../../services/session.js";
import { sessionsKeyboard } from "../keyboards/sessions.js";

export async function sessionsCommand(ctx: Context): Promise<void> {
  const sessions = await opencode.listSessions();

  if (sessions.length === 0) {
    await ctx.reply("No sessions yet. Use /new to create one.");
    return;
  }

  const state = getState(ctx.from!.id);
  const activeLabel = state.activeSessionId
    ? ` (active: ${sessions.find((s) => s.id === state.activeSessionId)?.slug ?? "unknown"})`
    : "";

  await ctx.reply(`📋 *Sessions*${activeLabel}\n\nSelect a session to resume:`, {
    parse_mode: "Markdown",
    reply_markup: sessionsKeyboard(sessions, 0),
  });
}

export async function newSessionCommand(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const state = getState(userId);

  const session = await opencode.createSession(state.activeDirectory);
  setState(userId, { activeSessionId: session.id });

  await ctx.reply(
    `✅ New session created: *${session.title || session.slug}*\n\nSend me a message to start coding.`,
    { parse_mode: "Markdown" }
  );
}
