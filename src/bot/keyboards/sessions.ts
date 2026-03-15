import { InlineKeyboard } from "grammy";
import type { OcSession } from "../../opencode/types.js";
import { truncate, timeAgo } from "../../utils/telegram.js";

const SESSIONS_PER_PAGE = 5;

export function sessionsKeyboard(sessions: OcSession[], page = 0): InlineKeyboard {
  const sorted = [...sessions].sort((a, b) => b.time.updated - a.time.updated);
  const totalPages = Math.ceil(sorted.length / SESSIONS_PER_PAGE);
  const start = page * SESSIONS_PER_PAGE;
  const pageItems = sorted.slice(start, start + SESSIONS_PER_PAGE);

  const kb = new InlineKeyboard();

  for (const session of pageItems) {
    const title = truncate(session.title || session.slug, 35);
    const ago = timeAgo(session.time.updated);
    kb.text(`${title} (${ago})`, `session:resume:${session.id}`).row();
  }

  if (totalPages > 1) {
    if (page > 0) kb.text("◀ Prev", `session:page:${page - 1}`);
    kb.text(`${page + 1}/${totalPages}`, "noop");
    if (page < totalPages - 1) kb.text("Next ▶", `session:page:${page + 1}`);
    kb.row();
  }

  kb.text("🆕 New Session", "session:new").row();

  return kb;
}

export function sessionActionsKeyboard(sessionId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 Fork", `session:fork:${sessionId}`)
    .text("🔗 Share", `session:share:${sessionId}`)
    .row()
    .text("📦 Compact", `session:compact:${sessionId}`)
    .text("🗑 Delete", `session:delete:${sessionId}`)
    .row()
    .text("« Back to sessions", "session:list");
}
