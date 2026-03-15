import type { Context } from "grammy";
import { opencode } from "../../opencode/client.js";
import { getState, setState } from "../../services/session.js";
import { sendStreamingResponse } from "../../services/streaming.js";
import { messageActionsKeyboard } from "../keyboards/actions.js";
import { logger } from "../../utils/logger.js";

export async function messageHandler(ctx: Context): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const userId = ctx.from!.id;
  const state = getState(userId);

  if (!state.activeSessionId) {
    await ctx.reply(
      "No active session. Use /new to create one or /sessions to resume an existing one."
    );
    return;
  }

  if (state.isBusy) {
    await ctx.reply("⏳ Still processing the previous message. Use /abort to cancel it.");
    return;
  }

  const thinking = await ctx.reply("⏳ Thinking...");
  setState(userId, { isBusy: true, lastMessageId: thinking.message_id });

  try {
    const response = await opencode.sendMessage(state.activeSessionId, text, {
      model: state.selectedModel ?? undefined,
      agent: state.selectedAgent ?? undefined,
    });

    await sendStreamingResponse(ctx.api, ctx.chat!.id, thinking.message_id, response);

    const lastAssistantId = response.info.id;
    if (lastAssistantId) {
      try {
        await ctx.api.sendMessage(ctx.chat!.id, "💬", {
          reply_markup: messageActionsKeyboard(state.activeSessionId, lastAssistantId),
        });
      } catch {
        // action buttons are non-critical
      }
    }
  } catch (err) {
    logger.error("Message send error", {
      error: String(err),
      sessionId: state.activeSessionId,
    });

    try {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        thinking.message_id,
        `❌ Error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } catch {
      await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  } finally {
    setState(userId, { isBusy: false });
  }
}
