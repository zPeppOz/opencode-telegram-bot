import type { Api } from "grammy";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { splitMessage } from "../utils/telegram.js";
import { formatAssistantMessage } from "./formatter.js";
import { events } from "../opencode/events.js";
import type { OcEvent, OcMessage, OcMessagePart } from "../opencode/types.js";

interface ActiveStream {
  chatId: number;
  threadId?: number;
  thinkingMsgId: number | null;
  sessionId: string;
  parts: Map<string, OcMessagePart>;
  messageInfo: OcMessage["info"] | null;
  lastSendTime: number;
  lastText: string;
  pendingUpdate: ReturnType<typeof setTimeout> | null;
  finalized: boolean;
  resolve: () => void;
}

const activeStreams = new Map<string, ActiveStream>();

function streamKey(sessionId: string): string {
  return sessionId;
}

function buildCurrentText(stream: ActiveStream): string {
  if (!stream.messageInfo) return "\u23F3 Thinking...";

  const message: OcMessage = {
    info: stream.messageInfo,
    parts: [...stream.parts.values()],
  };

  const text = formatAssistantMessage(message);
  return text || "\u23F3 Thinking...";
}

async function sendStreamUpdate(api: Api, stream: ActiveStream): Promise<void> {
  if (stream.finalized || !stream.thinkingMsgId) return;

  const text = buildCurrentText(stream);
  const truncated = text.slice(0, 4096);

  if (truncated === stream.lastText) return;

  try {
    await api.editMessageText(stream.chatId, stream.thinkingMsgId, truncated, {
      parse_mode: "HTML",
    });
    stream.lastText = truncated;
    stream.lastSendTime = Date.now();
  } catch (err) {
    logger.debug("Stream edit failed", { error: String(err) });
  }
}

function scheduleUpdate(api: Api, stream: ActiveStream): void {
  if (stream.finalized) return;

  const elapsed = Date.now() - stream.lastSendTime;
  const delay = Math.max(0, config.stream.throttleMs - elapsed);

  if (stream.pendingUpdate) {
    clearTimeout(stream.pendingUpdate);
  }

  stream.pendingUpdate = setTimeout(() => {
    stream.pendingUpdate = null;
    sendStreamUpdate(api, stream).catch(() => {});
  }, delay);
}

export async function startStream(
  api: Api,
  chatId: number,
  sessionId: string,
  _draftId: number,
  threadId?: number,
): Promise<void> {
  let thinkingMsgId: number | null = null;
  try {
    const msg = await api.sendMessage(chatId, "\u23F3 Thinking...", {
      message_thread_id: threadId,
    });
    thinkingMsgId = msg.message_id;
  } catch (err) {
    logger.error("Failed to send thinking message", { error: String(err) });
  }

  return new Promise<void>((resolve) => {
    const key = streamKey(sessionId);

    const existing = activeStreams.get(key);
    if (existing) {
      existing.finalized = true;
      if (existing.pendingUpdate) clearTimeout(existing.pendingUpdate);
      existing.resolve();
    }

    const stream: ActiveStream = {
      chatId,
      threadId,
      thinkingMsgId,
      sessionId,
      parts: new Map(),
      messageInfo: null,
      lastSendTime: 0,
      lastText: "",
      pendingUpdate: null,
      finalized: false,
      resolve,
    };

    activeStreams.set(key, stream);

    const unsubscribers: (() => void)[] = [];

    const cleanup = () => {
      for (const unsub of unsubscribers) unsub();
      activeStreams.delete(key);
    };

    unsubscribers.push(
      events.on("message.part.updated", (event: OcEvent) => {
        if (event.sessionID !== sessionId) return;
        const part = event.properties?.["part"] as OcMessagePart | undefined;
        if (!part) return;

        stream.parts.set(part.id, part);

        if (!stream.messageInfo && event.properties?.["info"]) {
          stream.messageInfo = event.properties["info"] as OcMessage["info"];
        }

        scheduleUpdate(api, stream);
      }),
    );

    unsubscribers.push(
      events.on("message.part.delta", (event: OcEvent) => {
        if (event.sessionID !== sessionId) return;
        const partId = event.properties?.["partID"] as string | undefined;
        const field = event.properties?.["field"] as string | undefined;
        const delta = event.properties?.["delta"] as string | undefined;
        if (!partId || !delta) return;

        const existing = stream.parts.get(partId);
        if (existing) {
          if (field === "text" && existing.type === "text") {
            existing.text = (existing.text ?? "") + delta;
          } else if (field === "text" && existing.type === "reasoning") {
            existing.text = (existing.text ?? "") + delta;
          }
        }

        scheduleUpdate(api, stream);
      }),
    );

    unsubscribers.push(
      events.on("message.updated", (event: OcEvent) => {
        if (event.sessionID !== sessionId) return;
        if (event.properties?.["info"]) {
          stream.messageInfo = event.properties["info"] as OcMessage["info"];
        }
      }),
    );

    unsubscribers.push(
      events.on("session.status", (event: OcEvent) => {
        if (event.sessionID !== sessionId) return;
        const status = event.properties?.["status"] as { type: string } | undefined;
        if (status?.type === "idle" || status?.type === "completed") {
          stream.finalized = true;
          if (stream.pendingUpdate) clearTimeout(stream.pendingUpdate);
          cleanup();
          resolve();
        }
      }),
    );

    setTimeout(() => {
      if (!stream.finalized) {
        stream.finalized = true;
        if (stream.pendingUpdate) clearTimeout(stream.pendingUpdate);
        cleanup();
        resolve();
      }
    }, 5 * 60 * 1000);
  });
}

export function cancelStream(sessionId: string): void {
  const key = streamKey(sessionId);
  const stream = activeStreams.get(key);
  if (stream) {
    stream.finalized = true;
    if (stream.pendingUpdate) clearTimeout(stream.pendingUpdate);
    stream.resolve();
    activeStreams.delete(key);
  }
}

export function isStreaming(sessionId: string): boolean {
  return activeStreams.has(streamKey(sessionId));
}

export function getThinkingMessageId(sessionId: string): number | null {
  return activeStreams.get(streamKey(sessionId))?.thinkingMsgId ?? null;
}

export async function sendFinalMessage(
  api: Api,
  chatId: number,
  response: OcMessage,
  threadId?: number,
  thinkingMsgId?: number | null,
): Promise<number | null> {
  const text = formatAssistantMessage(response);
  const chunks = splitMessage(text, config.stream.maxMessageLength);

  if (chunks.length === 0) {
    if (thinkingMsgId) {
      try {
        await api.editMessageText(chatId, thinkingMsgId, "(empty response)");
        return thinkingMsgId;
      } catch {
      }
    }
    const msg = await api.sendMessage(chatId, "(empty response)", {
      message_thread_id: threadId,
    });
    return msg.message_id;
  }

  let lastMsgId: number | null = null;

  for (let i = 0; i < chunks.length; i++) {
    try {
      if (i === 0 && thinkingMsgId) {
        await api.editMessageText(chatId, thinkingMsgId, chunks[i]!, {
          parse_mode: "HTML",
        });
        lastMsgId = thinkingMsgId;
      } else {
        const msg = await api.sendMessage(chatId, chunks[i]!, {
          message_thread_id: threadId,
          parse_mode: "HTML",
        });
        lastMsgId = msg.message_id;
      }
    } catch (err) {
      logger.error("Failed to send final message chunk", { error: String(err) });
    }
  }

  return lastMsgId;
}
