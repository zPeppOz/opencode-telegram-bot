import type { Context } from "grammy";
import { opencode } from "../../opencode/client.js";
import { getState, setState } from "../../services/session.js";
import { logger } from "../../utils/logger.js";
import { sessionsKeyboard, sessionActionsKeyboard } from "../keyboards/sessions.js";
import { providersKeyboard, modelsKeyboard } from "../keyboards/models.js";

export async function callbackHandler(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const userId = ctx.from!.id;
  const parts = data.split(":");

  try {
    switch (parts[0]) {
      case "session":
        await handleSession(ctx, userId, parts);
        break;
      case "model":
        await handleModel(ctx, userId, parts);
        break;
      case "agent":
        await handleAgent(ctx, userId, parts);
        break;
      case "project":
        await handleProject(ctx, userId, parts);
        break;
      case "action":
        await handleAction(ctx, userId, parts);
        break;
      case "confirm":
        await handleConfirm(ctx, userId, parts);
        break;
      case "perm":
        await handlePermission(ctx, userId, parts);
        break;
      case "noop":
        await ctx.answerCallbackQuery();
        break;
      default:
        await ctx.answerCallbackQuery({ text: "Unknown action" });
    }
  } catch (err) {
    logger.error("Callback handler error", { data, error: String(err) });
    await ctx.answerCallbackQuery({ text: "❌ Error occurred" });
  }
}

// ── Session callbacks ──────────────────────────────────────

async function handleSession(ctx: Context, userId: number, parts: string[]): Promise<void> {
  const action = parts[1];

  switch (action) {
    case "resume": {
      const sessionId = parts[2]!;
      setState(userId, { activeSessionId: sessionId });
      const session = await opencode.getSession(sessionId);
      await ctx.answerCallbackQuery({ text: `Resumed: ${session.slug}` });
      await ctx.editMessageText(
        `✅ Active session: *${session.title || session.slug}*\n📁 ${session.directory}`,
        {
          parse_mode: "Markdown",
          reply_markup: sessionActionsKeyboard(sessionId),
        }
      );
      break;
    }

    case "page": {
      const page = Number(parts[2]);
      const sessions = await opencode.listSessions();
      await ctx.answerCallbackQuery();
      await ctx.editMessageReplyMarkup({
        reply_markup: sessionsKeyboard(sessions, page),
      });
      break;
    }

    case "new": {
      const state = getState(userId);
      const session = await opencode.createSession(state.activeDirectory);
      setState(userId, { activeSessionId: session.id });
      await ctx.answerCallbackQuery({ text: "Session created" });
      await ctx.editMessageText(
        `✅ New session: *${session.title || session.slug}*\n\nSend me a message to start coding.`,
        { parse_mode: "Markdown" }
      );
      break;
    }

    case "fork": {
      const sessionId = parts[2]!;
      const forked = await opencode.forkSession(sessionId);
      setState(userId, { activeSessionId: forked.id });
      await ctx.answerCallbackQuery({ text: "Session forked" });
      await ctx.editMessageText(
        `🔀 Forked: *${forked.title || forked.slug}*`,
        { parse_mode: "Markdown" }
      );
      break;
    }

    case "share": {
      const sessionId = parts[2]!;
      try {
        const shareData = await opencode.shareSession(sessionId);
        await ctx.answerCallbackQuery({ text: "Share link created" });
        await ctx.editMessageText(`🔗 Share link:\n${shareData.url}`);
      } catch {
        await ctx.answerCallbackQuery({ text: "Failed to create share link" });
      }
      break;
    }

    case "compact": {
      const sessionId = parts[2]!;
      await ctx.answerCallbackQuery({ text: "Compacting..." });
      await opencode.summarizeSession(sessionId);
      await ctx.editMessageText("✅ Session compacted. Token usage reduced.");
      break;
    }

    case "delete": {
      const sessionId = parts[2]!;
      const state = getState(userId);
      await opencode.deleteSession(sessionId);
      if (state.activeSessionId === sessionId) {
        setState(userId, { activeSessionId: null });
      }
      await ctx.answerCallbackQuery({ text: "Session deleted" });
      const sessions = await opencode.listSessions();
      if (sessions.length > 0) {
        await ctx.editMessageText("📋 *Sessions*\n\nSelect a session to resume:", {
          parse_mode: "Markdown",
          reply_markup: sessionsKeyboard(sessions, 0),
        });
      } else {
        await ctx.editMessageText("No sessions left. Use /new to create one.");
      }
      break;
    }

    case "list": {
      const sessions = await opencode.listSessions();
      await ctx.answerCallbackQuery();
      if (sessions.length > 0) {
        await ctx.editMessageText("📋 *Sessions*\n\nSelect a session to resume:", {
          parse_mode: "Markdown",
          reply_markup: sessionsKeyboard(sessions, 0),
        });
      } else {
        await ctx.editMessageText("No sessions. Use /new to create one.");
      }
      break;
    }

    default:
      await ctx.answerCallbackQuery({ text: "Unknown session action" });
  }
}

// ── Model callbacks ────────────────────────────────────────

async function handleModel(ctx: Context, userId: number, parts: string[]): Promise<void> {
  const action = parts[1];

  switch (action) {
    case "provider": {
      const providerId = parts[2]!;
      const providersData = await opencode.getProviders();
      const provider = providersData.providers.find((p) => p.id === providerId);
      if (!provider) {
        await ctx.answerCallbackQuery({ text: "Provider not found" });
        return;
      }
      const state = getState(userId);
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(`🤖 *${provider.name}* — Select a model:`, {
        parse_mode: "Markdown",
        reply_markup: modelsKeyboard(provider, state.selectedModel?.modelID),
      });
      break;
    }

    case "select": {
      const providerId = parts[2]!;
      const modelId = parts.slice(3).join(":");
      setState(userId, { selectedModel: { providerID: providerId, modelID: modelId } });
      await ctx.answerCallbackQuery({ text: `Model: ${modelId}` });
      await ctx.editMessageText(`✅ Model set to \`${providerId}/${modelId}\``, {
        parse_mode: "Markdown",
      });
      break;
    }

    case "list": {
      const providersData = await opencode.getProviders();
      const state = getState(userId);
      let text = "🤖 *Select a provider:*\n";
      if (state.selectedModel) {
        text += `\nCurrent: \`${state.selectedModel.providerID}/${state.selectedModel.modelID}\``;
      }
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(text, {
        parse_mode: "Markdown",
        reply_markup: providersKeyboard(providersData.providers),
      });
      break;
    }

    default:
      await ctx.answerCallbackQuery({ text: "Unknown model action" });
  }
}

// ── Agent callbacks ────────────────────────────────────────

async function handleAgent(ctx: Context, userId: number, parts: string[]): Promise<void> {
  const action = parts[1];

  if (action === "select") {
    const agentId = parts[2]!;
    setState(userId, { selectedAgent: agentId });
    await ctx.answerCallbackQuery({ text: `Agent: ${agentId}` });
    await ctx.editMessageText(`✅ Agent set to *${agentId}*`, { parse_mode: "Markdown" });
    return;
  }

  await ctx.answerCallbackQuery({ text: "Unknown agent action" });
}

// ── Project callbacks ──────────────────────────────────────

async function handleProject(ctx: Context, userId: number, parts: string[]): Promise<void> {
  const action = parts[1];

  if (action === "select") {
    const dir = parts.slice(2).join(":");
    setState(userId, { activeDirectory: dir, activeSessionId: null });
    const shortDir = dir.replace(/^\/home\/[^/]+\//, "~/");
    await ctx.answerCallbackQuery({ text: `Project: ${shortDir}` });
    await ctx.editMessageText(
      `✅ Switched to *${shortDir}*\n\nUse /new to create a session in this project, or /sessions to see existing ones.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  await ctx.answerCallbackQuery({ text: "Unknown project action" });
}

// ── Action callbacks (undo, continue) ──────────────────────

async function handleAction(ctx: Context, userId: number, parts: string[]): Promise<void> {
  const action = parts[1];
  const state = getState(userId);

  switch (action) {
    case "undo": {
      const sessionId = parts[2]!;
      const messageId = parts[3]!;
      await ctx.answerCallbackQuery({ text: "Undoing..." });
      await opencode.revertMessage(sessionId, messageId);
      await ctx.editMessageText("↩️ Changes reverted.");
      break;
    }

    case "continue": {
      const sessionId = parts[2]!;
      if (state.isBusy) {
        await ctx.answerCallbackQuery({ text: "Already processing..." });
        return;
      }
      await ctx.answerCallbackQuery({ text: "Continuing..." });
      setState(userId, { isBusy: true });
      try {
        const response = await opencode.sendMessage(sessionId, "continue", {
          model: state.selectedModel ?? undefined,
          agent: state.selectedAgent ?? undefined,
        });
        const { formatResponse } = await import("../../services/streaming.js");
        const text = formatResponse(response);
        await ctx.editMessageText(text.slice(0, 4096));
      } finally {
        setState(userId, { isBusy: false });
      }
      break;
    }

    default:
      await ctx.answerCallbackQuery({ text: "Unknown action" });
  }
}

// ── Confirm callbacks ──────────────────────────────────────

async function handleConfirm(ctx: Context, userId: number, parts: string[]): Promise<void> {
  const action = parts[1];

  if (action === "cancel") {
    await ctx.answerCallbackQuery({ text: "Cancelled" });
    await ctx.editMessageText("❌ Cancelled.");
    return;
  }

  const id = parts.slice(2).join(":");
  const state = getState(userId);

  switch (action) {
    case "delete": {
      await opencode.deleteSession(id);
      if (state.activeSessionId === id) {
        setState(userId, { activeSessionId: null });
      }
      await ctx.answerCallbackQuery({ text: "Deleted" });
      await ctx.editMessageText("🗑 Session deleted.");
      break;
    }

    default:
      await ctx.answerCallbackQuery({ text: "Confirmed" });
  }
}

// ── Permission callbacks ───────────────────────────────────

async function handlePermission(ctx: Context, _userId: number, parts: string[]): Promise<void> {
  const action = parts[1];
  const sessionId = parts[2]!;

  try {
    const command = action === "allow" ? "yes" : "no";
    await opencode.sendCommand(sessionId, command);
    const label = action === "allow" ? "✅ Permission granted." : "❌ Permission denied.";
    await ctx.answerCallbackQuery({ text: label });
    await ctx.editMessageText(label);
  } catch (err) {
    logger.error("Permission response error", { error: String(err) });
    await ctx.answerCallbackQuery({ text: "Failed to respond" });
  }
}
