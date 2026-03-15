import type { Api } from "grammy";
import { events } from "../../opencode/events.js";
import { permissionKeyboard } from "../keyboards/actions.js";
import { logger } from "../../utils/logger.js";
import type { OcEvent } from "../../opencode/types.js";

/**
 * Register SSE event handlers that push permission dialogs to Telegram.
 *
 * When OpenCode needs approval for a tool call (file write, shell command, etc.),
 * it emits a permission event via SSE. We catch that and send an inline keyboard
 * to the Telegram chat so the user can approve/deny from their phone.
 */
export function registerPermissionHandler(api: Api, chatId: number): () => void {
  const unsubscribe = events.on("permission.request", (event: OcEvent) => {
    const sessionId = event.sessionID ?? "";
    const permissionId = (event.properties?.["id"] as string) ?? "unknown";
    const tool = (event.properties?.["tool"] as string) ?? "unknown tool";
    const args = event.properties?.["args"];

    let description = `🔐 *Permission Request*\n\nTool: \`${tool}\``;
    if (args && typeof args === "object") {
      const preview = Object.entries(args as Record<string, unknown>)
        .slice(0, 3)
        .map(([k, v]) => `  ${k}: ${String(v).slice(0, 80)}`)
        .join("\n");
      if (preview) {
        description += `\n\n\`\`\`\n${preview}\n\`\`\``;
      }
    }

    api
      .sendMessage(chatId, description, {
        parse_mode: "Markdown",
        reply_markup: permissionKeyboard(sessionId, permissionId),
      })
      .catch((err) => {
        logger.error("Failed to send permission dialog", { error: String(err) });
      });
  });

  return unsubscribe;
}
