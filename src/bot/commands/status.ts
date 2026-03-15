import type { Context } from "grammy";
import { opencode } from "../../opencode/client.js";
import { getState } from "../../services/session.js";
import { formatTokens, formatCost } from "../../utils/telegram.js";

export async function statusCommand(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const state = getState(userId);

  const healthy = await opencode.isHealthy();
  const lines: string[] = [];

  lines.push(healthy ? "🟢 *Server:* connected" : "🔴 *Server:* disconnected");

  if (state.activeSessionId) {
    try {
      const session = await opencode.getSession(state.activeSessionId);
      lines.push(`📝 *Session:* ${session.title || session.slug}`);
      lines.push(`📁 *Directory:* \`${session.directory}\``);

      if (session.summary) {
        lines.push(
          `📊 *Changes:* +${session.summary.additions}/-${session.summary.deletions} in ${session.summary.files} files`
        );
      }

      const statuses = await opencode.getSessionStatus();
      const sessionStatus = statuses[state.activeSessionId];
      if (sessionStatus) {
        const icon = sessionStatus.type === "busy" ? "⏳" : "💤";
        lines.push(`${icon} *Status:* ${sessionStatus.type}`);
      }

      const messages = await opencode.getMessages(state.activeSessionId);
      const lastAssistant = [...messages].reverse().find((m) => m.info.role === "assistant");
      if (lastAssistant?.info.tokens) {
        const t = lastAssistant.info.tokens;
        lines.push(`🔢 *Last tokens:* ${formatTokens(t.total)} (${formatTokens(t.input)}→${formatTokens(t.output)})`);
      }
      if (lastAssistant?.info.cost !== undefined) {
        lines.push(`💰 *Last cost:* ${formatCost(lastAssistant.info.cost)}`);
      }
    } catch {
      lines.push("📝 *Session:* (error loading)");
    }
  } else {
    lines.push("📝 *Session:* none — use /new or /sessions");
  }

  if (state.selectedModel) {
    lines.push(`🤖 *Model:* \`${state.selectedModel.providerID}/${state.selectedModel.modelID}\``);
  }

  if (state.selectedAgent) {
    lines.push(`🧠 *Agent:* ${state.selectedAgent}`);
  }

  await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
}
