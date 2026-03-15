import type { Context, NextFunction, RawApi } from "grammy";
import type { Transformer } from "grammy";
import { getSessionForTopic } from "../../services/topic-store.js";

const chatThreads = new Map<number, number>();

export function getChatThreadId(chatId: number): number | undefined {
  return chatThreads.get(chatId);
}

export function getSessionFromContext(ctx: Context): string | undefined {
  const chatId = ctx.chat?.id;
  const threadId = ctx.message?.message_thread_id
    ?? ctx.callbackQuery?.message?.message_thread_id;

  if (chatId && threadId) {
    return getSessionForTopic(chatId, threadId);
  }
  return undefined;
}

export async function threadMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    await next();
    return;
  }

  const threadId = ctx.message?.message_thread_id
    ?? ctx.callbackQuery?.message?.message_thread_id
    ?? undefined;

  if (threadId) {
    chatThreads.set(chatId, threadId);
  }

  await next();
}

const THREAD_AWARE_METHODS = new Set([
  "sendMessage",
  "sendPhoto",
  "sendDocument",
  "sendVideo",
  "sendAnimation",
  "sendVoice",
  "sendAudio",
  "sendSticker",
  "sendLocation",
  "sendContact",
  "sendPoll",
  "sendDice",
  "sendMediaGroup",
  "sendMessageDraft",
]);

export const threadTransformer: Transformer<RawApi> = (prev, method, payload, signal) => {
  if (THREAD_AWARE_METHODS.has(method)) {
    const p = payload as Record<string, unknown>;
    if (!p["message_thread_id"] && p["chat_id"]) {
      const threadId = chatThreads.get(Number(p["chat_id"]));
      if (threadId) {
        p["message_thread_id"] = threadId;
      }
    }
  }
  return prev(method, payload, signal);
};
