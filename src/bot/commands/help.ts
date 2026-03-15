import type { Context } from "grammy";

const HELP_TEXT = `*OpenCode Telegram Bot — Commands*

*Session Management*
/new — Create a new coding session
/sessions — Browse and resume sessions
/fork — Fork current session
/share — Get shareable link
/compact — Summarize to save tokens

*AI Control*
/models — Switch AI model
/agent — Switch agent (Build, Plan, etc.)
/abort — Stop current generation

*Project*
/project — Switch project directory
/status — Current session info + stats

*Auth*
/auth <PIN> — Authenticate with PIN
/whoami — Show your auth status
/grant <id> [owner|user] — Grant access (owner only)
/revoke <id> — Revoke access (owner only)

*Other*
/stats — Token usage and costs
/help — This message

Any text message is sent as a prompt to the active session.`;

export async function helpCommand(ctx: Context): Promise<void> {
  await ctx.reply(HELP_TEXT, { parse_mode: "Markdown" });
}
