import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import type { Context } from "grammy";
import { opencode } from "../../opencode/client.js";
import { getState, setState } from "../../services/session.js";
import { sessionsKeyboard } from "../keyboards/sessions.js";

function resolveDir(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "~") return homedir();
  if (trimmed.startsWith("~/")) return resolve(homedir(), trimmed.slice(2));
  return resolve(trimmed);
}

function shortenDir(dir: string): string {
  return dir.replace(new RegExp(`^${homedir()}/`), "~/");
}

export async function sessionsCommand(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const state = getState(userId);

  const text = ctx.message?.text ?? "";
  const arg = text.replace(/^\/sessions\s*/, "").trim();

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

    const allSessions = await opencode.listSessions();
    const filtered = allSessions.filter((s) => s.directory === dir);

    if (filtered.length === 0) {
      await ctx.reply(
        `📁 Switched to *${shortDir}*\n\nNo sessions in this directory yet. Use /new to create one.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    await ctx.reply(
      `📁 *${shortDir}* — ${filtered.length} session${filtered.length > 1 ? "s" : ""}\n\nSelect a session to resume:`,
      {
        parse_mode: "Markdown",
        reply_markup: sessionsKeyboard(filtered, 0),
      }
    );
    return;
  }

  const sessions = await opencode.listSessions();

  if (sessions.length === 0) {
    await ctx.reply("No sessions yet. Use /new to create one.");
    return;
  }

  const activeLabel = state.activeSessionId
    ? ` (active: ${sessions.find((s) => s.id === state.activeSessionId)?.slug ?? "unknown"})`
    : "";

  await ctx.reply(`📋 *Sessions*${activeLabel}\n\nSelect a session to resume:`, {
    parse_mode: "Markdown",
    reply_markup: sessionsKeyboard(sessions, 0),
  });
}

export async function newSessionCommand(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const state = getState(userId);

  const session = await opencode.createSession(state.activeDirectory);
  setState(userId, { activeSessionId: session.id });

  await ctx.reply(
    `✅ New session created: *${session.title || session.slug}*\n\nSend me a message to start coding.`,
    { parse_mode: "Markdown" }
  );
}
