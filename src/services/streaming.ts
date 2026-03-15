import type { Api } from "grammy";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { splitMessage } from "../utils/telegram.js";
import type { OcMessage, OcMessagePart } from "../opencode/types.js";

export function formatResponse(message: OcMessage): string {
  const textParts: string[] = [];
  const toolParts: string[] = [];

  for (const part of message.parts) {
    switch (part.type) {
      case "text":
        if (part.text) textParts.push(part.text);
        break;
      case "tool-invocation":
        if (part.toolName) {
          const argsPreview = part.args
            ? Object.keys(part.args).join(", ")
            : "";
          toolParts.push(`🔧 ${part.toolName}(${argsPreview})`);
        }
        break;
      case "step-finish":
        if (part.tokens) {
          const t = part.tokens;
          textParts.push(
            `\n📊 ${t.input}→${t.output} tokens | ${part.cost ? `$${part.cost.toFixed(4)}` : "free"}`
          );
        }
        break;
    }
  }

  const parts: string[] = [];
  if (toolParts.length > 0) {
    parts.push(toolParts.join("\n"));
  }
  if (textParts.length > 0) {
    parts.push(textParts.join("\n"));
  }

  return parts.join("\n\n") || "(empty response)";
}

export function extractTextFromParts(parts: OcMessagePart[]): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("\n");
}

export async function sendStreamingResponse(
  api: Api,
  chatId: number,
  thinkingMessageId: number,
  response: OcMessage
): Promise<void> {
  const fullText = formatResponse(response);
  const chunks = splitMessage(fullText, config.stream.maxMessageLength);

  if (chunks.length === 0) {
    await safeEditMessage(api, chatId, thinkingMessageId, "(empty response)");
    return;
  }

  await safeEditMessage(api, chatId, thinkingMessageId, chunks[0]!);

  for (let i = 1; i < chunks.length; i++) {
    await api.sendMessage(chatId, chunks[i]!);
  }
}

async function safeEditMessage(
  api: Api,
  chatId: number,
  messageId: number,
  text: string
): Promise<void> {
  try {
    await api.editMessageText(chatId, messageId, text);
  } catch (err) {
    logger.warn("Failed to edit message", { error: String(err) });
    try {
      await api.sendMessage(chatId, text);
    } catch (sendErr) {
      logger.error("Failed to send fallback message", { error: String(sendErr) });
    }
  }
}
