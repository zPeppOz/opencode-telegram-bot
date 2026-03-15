import type { Context } from "grammy";
import { config } from "../../config.js";
import {
  isAuthorized,
  isOwner,
  getRole,
  getEntry,
  getAllUsers,
  grantAccess,
  revokeAccess,
} from "../../services/auth-store.js";
import { logger } from "../../utils/logger.js";

const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const failedAttempts = new Map<number, { count: number; lastAttempt: number }>();

function checkBruteForce(userId: number): boolean {
  const record = failedAttempts.get(userId);
  if (!record) return false;
  if (record.count >= MAX_PIN_ATTEMPTS) {
    if (Date.now() - record.lastAttempt < LOCKOUT_MS) return true;
    failedAttempts.delete(userId);
  }
  return false;
}

function recordFailedAttempt(userId: number): void {
  const record = failedAttempts.get(userId) ?? { count: 0, lastAttempt: 0 };
  record.count++;
  record.lastAttempt = Date.now();
  failedAttempts.set(userId, record);
}

export async function authCommand(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;

  if (isAuthorized(userId)) {
    await ctx.reply(`Sei già autenticato come *${getRole(userId)}*.`, { parse_mode: "Markdown" });
    return;
  }

  if (!config.auth.pin) {
    await ctx.reply("⛔ Autenticazione via PIN non configurata. Contatta l'owner.");
    return;
  }

  if (checkBruteForce(userId)) {
    await ctx.reply("🔒 Troppi tentativi falliti. Riprova tra 15 minuti.");
    return;
  }

  const text = ctx.message?.text ?? "";
  const pin = text.split(/\s+/)[1];

  if (!pin) {
    await ctx.reply("Uso: /auth <PIN>");
    return;
  }

  if (pin !== config.auth.pin) {
    recordFailedAttempt(userId);
    const record = failedAttempts.get(userId)!;
    const remaining = MAX_PIN_ATTEMPTS - record.count;
    logger.warn("Failed PIN attempt", { userId, username: ctx.from?.username, remaining });
    await ctx.reply(`❌ PIN errato. ${remaining > 0 ? `${remaining} tentativi rimasti.` : "Account bloccato per 15 minuti."}`);
    return;
  }

  failedAttempts.delete(userId);
  const hasAnyOwner = getAllUsers().some((u) => u.role === "owner");
  const role = hasAnyOwner ? "user" : "owner";

  grantAccess(userId, role, userId, ctx.from?.username);
  logger.info("User authenticated via PIN", { userId, username: ctx.from?.username, role });
  await ctx.reply(`✅ Autenticato come *${role}*. Usa /help per i comandi.`, { parse_mode: "Markdown" });
}

export async function grantCommand(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;

  if (!isOwner(userId)) {
    await ctx.reply("⛔ Solo gli owner possono usare /grant.");
    return;
  }

  const text = ctx.message?.text ?? "";
  const args = text.split(/\s+/).slice(1);
  const targetId = Number(args[0]);
  const role = (args[1] === "owner" ? "owner" : "user") as "owner" | "user";

  if (!targetId || isNaN(targetId)) {
    await ctx.reply("Uso: /grant <userId> [owner|user]");
    return;
  }

  grantAccess(targetId, role, userId);
  logger.info("Access granted", { targetId, role, grantedBy: userId });
  await ctx.reply(`✅ Utente \`${targetId}\` autorizzato come *${role}*.`, { parse_mode: "Markdown" });
}

export async function revokeCommand(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;

  if (!isOwner(userId)) {
    await ctx.reply("⛔ Solo gli owner possono usare /revoke.");
    return;
  }

  const text = ctx.message?.text ?? "";
  const targetId = Number(text.split(/\s+/)[1]);

  if (!targetId || isNaN(targetId)) {
    await ctx.reply("Uso: /revoke <userId>");
    return;
  }

  if (targetId === userId) {
    await ctx.reply("❌ Non puoi revocarti l'accesso da solo.");
    return;
  }

  const success = revokeAccess(targetId);
  if (success) {
    logger.info("Access revoked", { targetId, revokedBy: userId });
    await ctx.reply(`✅ Accesso revocato per \`${targetId}\`.`, { parse_mode: "Markdown" });
  } else {
    await ctx.reply("❌ Utente non trovato o è l'ultimo owner.");
  }
}

export async function whoamiCommand(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const entry = getEntry(userId);

  if (!entry) {
    await ctx.reply(`ID: \`${userId}\`\nStato: non autorizzato`, { parse_mode: "Markdown" });
    return;
  }

  const lines = [
    `ID: \`${userId}\``,
    `Ruolo: *${entry.role}*`,
    `Autorizzato da: \`${entry.grantedBy}\``,
    `Data: ${new Date(entry.grantedAt).toLocaleString("it-IT")}`,
  ];

  if (entry.role === "owner") {
    const users = getAllUsers();
    lines.push(`\nUtenti autorizzati: ${users.length}`);
    for (const u of users) {
      const name = u.username ? `@${u.username}` : String(u.userId);
      lines.push(`  ${u.role === "owner" ? "👑" : "👤"} ${name} (\`${u.userId}\`)`);
    }
  }

  await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
}
