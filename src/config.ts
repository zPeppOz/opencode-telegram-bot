import "dotenv/config";

const requiredEnv = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env: ${key}`);
  return val;
};

export const config = {
  telegram: {
    token: requiredEnv("TELEGRAM_BOT_TOKEN"),
    allowedUsers: (process.env["TELEGRAM_ALLOWED_USERS"] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number),
  },
  auth: {
    pin: process.env["AUTH_PIN"] ?? "",
    dataDir: process.env["AUTH_DATA_DIR"] ?? ".data",
  },
  opencode: {
    apiUrl: process.env["OPENCODE_API_URL"] ?? "http://127.0.0.1:4096",
    password: process.env["OPENCODE_SERVER_PASSWORD"] ?? "",
    defaultDir: process.env["OPENCODE_DEFAULT_DIR"] ?? process.env["HOME"] ?? "/tmp",
    autoStart: process.env["OPENCODE_AUTO_START"] !== "false",
    binPath: process.env["OPENCODE_BIN_PATH"] ?? "",
  },
  stream: {
    throttleMs: Number(process.env["STREAM_THROTTLE_MS"] ?? "800"),
    maxMessageLength: Number(process.env["MAX_MESSAGE_LENGTH"] ?? "4000"),
  },
  logLevel: (process.env["LOG_LEVEL"] ?? "info") as "debug" | "info" | "warn" | "error",
} as const;
