import type { Context } from "grammy";
import { opencode } from "../../opencode/client.js";
import { getState, setState } from "../../services/session.js";

export async function startCommand(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const state = getState(userId);

  let statusText = "🚀 *OpenCode Telegram Bot*\n\nControl OpenCode from your phone.\n\n";

  const healthy = await opencode.isHealthy();
  statusText += healthy ? "🟢 Server: connected\n" : "🔴 Server: disconnected\n";

  if (state.activeSessionId) {
    try {
      const session = await opencode.getSession(state.activeSessionId);
      statusText += `📝 Session: ${session.title || session.slug}\n`;
    } catch {
      setState(userId, { activeSessionId: null });
      statusText += "📝 Session: none\n";
    }
  } else {
    statusText += "📝 Session: none\n";
  }

  statusText += `📁 Project: ${state.activeDirectory}\n`;

  if (state.selectedModel) {
    statusText += `🤖 Model: ${state.selectedModel.providerID}/${state.selectedModel.modelID}\n`;
  }

  statusText += "\nUse /help to see all commands.";

  await ctx.reply(statusText, { parse_mode: "Markdown" });
}
