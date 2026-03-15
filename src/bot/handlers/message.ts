import type { Context } from "grammy";
import { opencode } from "../../opencode/client.js";
import { getState, setState } from "../../services/session.js";
import { getSessionFromContext } from "../middleware/thread.js";
import { startStream, sendFinalMessage, cancelStream, getThinkingMessageId } from "../../services/streaming.js";
import { messageActionsKeyboard } from "../keyboards/actions.js";
import { switcherKeyboard } from "../keyboards/switcher.js";
import { logger } from "../../utils/logger.js";

export async function messageHandler(ctx: Context): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const userId = ctx.from!.id;
  const chatId = ctx.chat!.id;
  const state = getState(userId);

  const topicSessionId = getSessionFromContext(ctx);
  const sessionId = topicSessionId ?? state.activeSessionId;

  if (!sessionId) {
    await ctx.reply(
      "No active session. Use /new to create one or /sessions to resume an existing one."
    );
    return;
  }

  if (topicSessionId && topicSessionId !== state.activeSessionId) {
    setState(userId, { activeSessionId: topicSessionId });
  }

  if (state.isBusy) {
    await ctx.reply("\u23F3 Still processing the previous message. Use /abort to cancel it.");
    return;
  }

  setState(userId, { isBusy: true });
  const threadId = ctx.message?.message_thread_id;
  const draftId = ctx.update.update_id;
  const api = ctx.api;

  // Fire-and-forget: send message and handle streaming in background
  // so grammY's update loop is not blocked.
  const run = async () => {
    try {
      await opencode.sendMessageAsync(sessionId, text, {
        model: state.selectedModel ?? undefined,
        agent: state.selectedAgent ?? undefined,
      });

      await startStream(api, chatId, sessionId, draftId, threadId);

      const thinkingMsgId = getThinkingMessageId(sessionId);
      const messages = await opencode.getMessages(sessionId);
      const lastAssistant = [...messages].reverse().find((m) => m.info.role === "assistant");

      if (lastAssistant) {
        const msgId = await sendFinalMessage(api, chatId, lastAssistant, threadId, thinkingMsgId);
        if (msgId) {
          setState(userId, { lastMessageId: msgId });
          try {
            await api.sendMessage(chatId, "\u{1F4AC}", {
              message_thread_id: threadId,
              reply_markup: messageActionsKeyboard(sessionId, lastAssistant.info.id),
            });
          } catch {
          }
          try {
            await api.sendMessage(chatId, "\u2699\uFE0F", {
              message_thread_id: threadId,
              reply_markup: switcherKeyboard(),
            });
          } catch {
          }
        }
      }
    } catch (err) {
      cancelStream(sessionId);
      logger.error("Message send error", {
        error: String(err),
        sessionId,
      });
      try {
        await api.sendMessage(chatId, `\u274C Error: ${err instanceof Error ? err.message : "Unknown error"}`, {
          message_thread_id: threadId,
        });
      } catch {
      }
    } finally {
      setState(userId, { isBusy: false });
    }
  };

  run().catch((err) => {
    logger.error("Background message handler crashed", { error: String(err), sessionId });
    setState(userId, { isBusy: false });
  });
}
