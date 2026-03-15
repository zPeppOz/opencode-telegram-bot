import { config } from "./config.js";
import { setLogLevel, logger } from "./utils/logger.js";
import { initAuthStore } from "./services/auth-store.js";
import { startServer, stopServer } from "./opencode/server.js";
import { events } from "./opencode/events.js";
import { registerPermissionHandler } from "./bot/handlers/permission.js";
import { createBot } from "./bot/bot.js";

async function main(): Promise<void> {
  setLogLevel(config.logLevel);
  logger.info("Starting OpenCode Telegram Bot");

  initAuthStore();

  if (config.opencode.autoStart) {
    await startServer();
  }

  const bot = createBot();

  await events.start();
  logger.info("SSE event listener started");

  if (config.telegram.allowedUsers.length > 0) {
    for (const chatId of config.telegram.allowedUsers) {
      registerPermissionHandler(bot.api, chatId);
    }
  }

  const shutdown = async () => {
    logger.info("Shutting down...");
    events.stop();
    await bot.stop();
    if (config.opencode.autoStart) {
      stopServer();
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await bot.start({
    onStart: () => logger.info("Bot is running"),
  });
}

main().catch((err) => {
  logger.error("Fatal error", { error: String(err) });
  process.exit(1);
});
