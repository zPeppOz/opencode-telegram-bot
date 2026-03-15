import type { Context } from "grammy";
import { opencode } from "../../opencode/client.js";
import { getState } from "../../services/session.js";
import { getSessionFromContext } from "../middleware/thread.js";
import { formatSessionMessages } from "../../services/formatter.js";
import { splitMessage } from "../../utils/telegram.js";
import { config } from "../../config.js";

export async function historyCommand(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const chatId = ctx.chat!.id;
  const threadId = ctx.message?.message_thread_id;

  const topicSessionId = getSessionFromContext(ctx);
  const sessionId = topicSessionId ?? getState(userId).activeSessionId;

  if (!sessionId) {
    await ctx.reply("No active session. Use /sessions to pick one.");
    return;
  }

  const text = ctx.message?.text ?? "";
  const arg = text.replace(/^\/history\s*/, "").trim();
  const limit = arg ? Math.min(Math.max(parseInt(arg, 10) || 50, 1), 200) : 50;

  const messages = await opencode.getMessages(sessionId);
  const formatted = formatSessionMessages(messages, limit);

  if (formatted.length === 0) {
    await ctx.reply("📭 No messages in this session.");
    return;
  }

  for (const msg of formatted) {
    const chunks = splitMessage(msg, config.stream.maxMessageLength);
    for (const chunk of chunks) {
      await ctx.api.sendMessage(chatId, chunk, {
        message_thread_id: threadId,
      });
    }
  }
}
