import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { opencode } from "../../opencode/client.js";
import { getState, setState } from "../../services/session.js";

export async function projectCommand(ctx: Context): Promise<void> {
  const sessions = await opencode.listSessions();
  const dirs = [...new Set(sessions.map((s) => s.directory))].sort();
  const state = getState(ctx.from!.id);

  if (dirs.length === 0) {
    await ctx.reply("No projects found. Create a session first with /new.");
    return;
  }

  const kb = new InlineKeyboard();
  for (const dir of dirs.slice(0, 20)) {
    const isCurrent = dir === state.activeDirectory;
    const prefix = isCurrent ? "✅ " : "";
    const shortDir = dir.replace(/^\/home\/[^/]+\//, "~/");
    kb.text(`${prefix}${shortDir}`, `project:select:${dir}`).row();
  }

  await ctx.reply("📁 *Select a project directory:*", {
    parse_mode: "Markdown",
    reply_markup: kb,
  });
}

export async function abortCommand(ctx: Context): Promise<void> {
  const state = getState(ctx.from!.id);
  if (!state.activeSessionId) {
    await ctx.reply("No active session.");
    return;
  }

  const result = await opencode.abortSession(state.activeSessionId);
  await ctx.reply(result ? "⏹ Generation aborted." : "Nothing to abort.");
}

export async function shareCommand(ctx: Context): Promise<void> {
  const state = getState(ctx.from!.id);
  if (!state.activeSessionId) {
    await ctx.reply("No active session.");
    return;
  }

  try {
    const shareData = await opencode.shareSession(state.activeSessionId);
    await ctx.reply(`🔗 Share link: ${shareData.url}`);
  } catch {
    await ctx.reply("Failed to create share link.");
  }
}

export async function forkCommand(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const state = getState(userId);
  if (!state.activeSessionId) {
    await ctx.reply("No active session.");
    return;
  }

  const forked = await opencode.forkSession(state.activeSessionId);
  setState(userId, { activeSessionId: forked.id });
  await ctx.reply(`🔀 Session forked: *${forked.title || forked.slug}*`, { parse_mode: "Markdown" });
}

export async function compactCommand(ctx: Context): Promise<void> {
  const state = getState(ctx.from!.id);
  if (!state.activeSessionId) {
    await ctx.reply("No active session.");
    return;
  }

  await ctx.reply("📦 Compacting session...");
  await opencode.summarizeSession(state.activeSessionId);
  await ctx.reply("✅ Session compacted. Token usage reduced.");
}

export async function statsCommand(ctx: Context): Promise<void> {
  const state = getState(ctx.from!.id);
  if (!state.activeSessionId) {
    await ctx.reply("No active session. Use /new or /sessions first.");
    return;
  }

  const messages = await opencode.getMessages(state.activeSessionId);
  let totalInput = 0;
  let totalOutput = 0;
  let totalCost = 0;
  let messageCount = 0;

  for (const msg of messages) {
    if (msg.info.role === "assistant") {
      messageCount++;
      if (msg.info.tokens) {
        totalInput += msg.info.tokens.input;
        totalOutput += msg.info.tokens.output;
      }
      if (msg.info.cost) {
        totalCost += msg.info.cost;
      }
    }
  }

  const lines = [
    "📊 *Session Stats*",
    `Messages: ${messageCount}`,
    `Input tokens: ${totalInput.toLocaleString()}`,
    `Output tokens: ${totalOutput.toLocaleString()}`,
    `Total cost: $${totalCost.toFixed(4)}`,
  ];

  await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
}
