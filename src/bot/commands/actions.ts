import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import type { Context } from "grammy";
import { opencode } from "../../opencode/client.js";
import { getState, setState } from "../../services/session.js";
import { config } from "../../config.js";
import { projectsKeyboard } from "../keyboards/projects.js";

function resolveDir(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "~") return homedir();
  if (trimmed.startsWith("~/")) return resolve(homedir(), trimmed.slice(2));
  return resolve(trimmed);
}

export function shortenDir(dir: string): string {
  return dir.replace(new RegExp(`^${homedir()}/`), "~/");
}

export function listSubdirectories(baseDir: string): string[] {
  try {
    const entries = readdirSync(baseDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => join(baseDir, e.name))
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  } catch {
    return [];
  }
}

export async function projectCommand(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;

  const text = ctx.message?.text ?? "";
  const arg = text.replace(/^\/project\s*/, "").trim();

  if (arg) {
    const dir = resolveDir(arg);

    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true });
      } catch (err) {
        await ctx.reply(`❌ Cannot create directory: \`${dir}\`\n${String(err)}`);
        return;
      }
    }

    setState(userId, { activeDirectory: dir, activeSessionId: null });
    const shortDir = shortenDir(dir);
    await ctx.reply(
      `✅ Switched to *${shortDir}*\n\nUse /new to create a session in this project, or /sessions to see existing ones.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const baseDir = config.opencode.defaultDir;
  const dirs = listSubdirectories(baseDir);
  const state = getState(userId);

  if (dirs.length === 0) {
    await ctx.reply("No directories found. Use `/project ~/path` to set a directory manually.", {
      parse_mode: "Markdown",
    });
    return;
  }

  const kb = projectsKeyboard(dirs, state.activeDirectory, shortenDir, 0);

  const shortBase = shortenDir(baseDir);
  await ctx.reply(`📁 *Directories in* \`${shortBase}\`\n\nOr use \`/project ~/path\` to set a custom directory.`, {
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
