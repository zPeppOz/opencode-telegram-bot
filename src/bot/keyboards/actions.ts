import { InlineKeyboard } from "grammy";

export function messageActionsKeyboard(sessionId: string, messageId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("↩️ Undo", `action:undo:${sessionId}:${messageId}`)
    .text("🔄 Continue", `action:continue:${sessionId}`);
}

export function confirmKeyboard(action: string, id: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Yes", `confirm:${action}:${id}`)
    .text("❌ No", "confirm:cancel");
}

export function permissionKeyboard(sessionId: string, permissionId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Allow", `perm:allow:${sessionId}:${permissionId}`)
    .text("❌ Deny", `perm:deny:${sessionId}:${permissionId}`);
}
