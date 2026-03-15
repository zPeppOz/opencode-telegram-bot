# OpenCode Telegram Bot

Control [OpenCode](https://opencode.ai) from your phone via Telegram. Run AI coding sessions, switch models, manage projects — all from a chat interface.

## What It Does

This bot connects to an OpenCode headless server running on your machine and exposes its full functionality through Telegram commands and inline keyboards. You get:

- **Full session management** — create, resume, fork, delete, share sessions
- **Real-time streaming** — AI responses stream into Telegram via progressive message edits
- **Model & agent switching** — pick any configured model/agent with inline keyboards
- **Multi-project support** — switch between projects without leaving the chat
- **File attachments** — send images, code files, PDFs as context
- **Permission handling** — approve/deny tool calls and file writes via inline buttons
- **Server lifecycle** — auto-start/stop the OpenCode server, health monitoring
- **Cost tracking** — token usage and cost stats per session

## Architecture

```
┌──────────┐     HTTPS      ┌──────────────┐    HTTP/SSE     ┌─────────────────┐
│ Telegram │ ◄────────────► │  Telegram Bot │ ◄────────────► │ OpenCode Server │
│  (Phone) │   Bot API      │  (grammY)     │   localhost     │ (opencode serve)│
└──────────┘                └──────────────┘                 └─────────────────┘
                                   │
                            ┌──────┴──────┐
                            ▼             ▼
                     ┌────────────┐ ┌───────────┐
                     │ Auth Store │ │   State   │
                     │  (.json)   │ │ (memory)  │
                     └────────────┘ └───────────┘
```

The bot runs alongside the OpenCode server on the same machine. Communication happens over `localhost` via OpenCode's REST API and SSE event stream. Auth data is persisted to disk; session state is held in memory.

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize bot, show welcome and current status |
| `/auth <PIN>` | Authenticate with PIN code |
| `/whoami` | Show your auth status and role |
| `/grant <id> [owner\|user]` | Grant access to a user (owner only) |
| `/revoke <id>` | Revoke user access (owner only) |
| `/new` | Create a new coding session |
| `/sessions` | Browse and resume existing sessions |
| `/models` | Switch AI model (inline keyboard picker) |
| `/agent` | Switch agent (Build, Plan, custom agents) |
| `/project` | Switch active project directory |
| `/status` | Show current session, model, project, token usage |
| `/abort` | Stop the current AI generation |
| `/share` | Generate a shareable link for current session |
| `/compact` | Summarize session to reduce token usage |
| `/fork` | Branch current session at this point |
| `/undo` | Revert last AI changes |
| `/stats` | Show cost and token statistics |
| `/help` | List all commands |

Any text message that isn't a command is sent as a prompt to the active session.

## Inline Keyboards

The bot uses Telegram inline keyboards extensively for navigation:

- **Session list** — paginated, with resume/delete/fork actions
- **Model picker** — grouped by provider, shows current selection
- **Agent picker** — all available agents with descriptions
- **Project picker** — all detected project directories
- **Permission dialogs** — approve/deny buttons for tool calls
- **Message actions** — undo, regenerate, continue on each response

## Quick Start

### Prerequisites

- Node.js 20+
- OpenCode installed (`npm i -g opencode-ai` or [opencode.ai](https://opencode.ai))
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))
- Your Telegram user ID (see below)

### How to Find Your Telegram User ID

Your numeric Telegram user ID is needed for `TELEGRAM_ALLOWED_USERS`. There are several ways to find it:

1. **@userinfobot** — Open Telegram, search for [@userinfobot](https://t.me/userinfobot), start a chat and send any message. It will reply with your user ID.
2. **@RawDataBot** — Same idea: message [@RawDataBot](https://t.me/RawDataBot) and it will show your full user info including the numeric ID.
3. **Telegram API (Settings)** — On Telegram Desktop, go to Settings → Advanced → Experimental Settings and enable "Show Peer IDs in Profile". Your ID will appear in your profile.
4. **Bot API update** — If the bot is already running, check the logs. Every incoming message includes the sender's `from.id` field.

> **Note:** A Telegram user ID is a number like `123456789`. It's NOT your username (`@yourname`).

### Setup

```bash
# Clone the repo
git clone https://github.com/your-user/opencode-telegram-bot
cd opencode-telegram-bot

# Install dependencies
npm install

# Configure
cp .env.example .env
# Edit .env with your settings (see Configuration below)

# Build & run
npm run build
npm start
```

### Configuration

Create a `.env` file:

```env
# Required
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather
TELEGRAM_ALLOWED_USERS=123456789

# Authentication
AUTH_PIN=change-me-to-a-secure-pin
AUTH_DATA_DIR=.data

# OpenCode Server
OPENCODE_API_URL=http://127.0.0.1:4096
OPENCODE_SERVER_PASSWORD=
OPENCODE_DEFAULT_DIR=/home/you/projects/my-project

# Optional
OPENCODE_AUTO_START=true
OPENCODE_BIN_PATH=/home/you/.opencode/bin/opencode
LOG_LEVEL=info
STREAM_THROTTLE_MS=800
MAX_MESSAGE_LENGTH=4000
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | — | Bot token from BotFather |
| `TELEGRAM_ALLOWED_USERS` | Yes | — | Comma-separated Telegram user IDs (first ID becomes owner) |
| `AUTH_PIN` | Yes | — | PIN code for authenticating new users via `/auth` |
| `AUTH_DATA_DIR` | No | `.data` | Directory for persistent auth data (JSON store) |
| `OPENCODE_API_URL` | No | `http://127.0.0.1:4096` | OpenCode server URL |
| `OPENCODE_SERVER_PASSWORD` | No | — | Basic auth password for server |
| `OPENCODE_DEFAULT_DIR` | No | `~` | Default project directory |
| `OPENCODE_AUTO_START` | No | `true` | Auto-start opencode serve on bot start |
| `OPENCODE_BIN_PATH` | No | auto-detect | Path to opencode binary |
| `LOG_LEVEL` | No | `info` | Log level (debug, info, warn, error) |
| `STREAM_THROTTLE_MS` | No | `800` | Min ms between message edits during streaming |
| `MAX_MESSAGE_LENGTH` | No | `4000` | Max chars per Telegram message (splits if longer) |

## How It Works

### Message Flow

1. User sends text in Telegram
2. Bot forwards it to OpenCode via `POST /session/{id}/message`
3. OpenCode processes with the configured AI model
4. Bot receives the complete response (with all parts: text, tool calls, etc.)
5. Bot formats and sends the response back, editing the "thinking..." message progressively

### Streaming

The bot sends a "Thinking..." message immediately, then updates it as the response streams in. Edits are throttled (default 800ms) to stay within Telegram's rate limits. Long responses are split across multiple messages.

### SSE Events

The bot maintains an SSE connection to `GET /event` on the OpenCode server for real-time events:

- **Session status changes** — busy/idle indicators
- **Permission requests** — tool approval dialogs pushed immediately  
- **Server health** — heartbeat monitoring

### Permission Handling

When OpenCode needs approval (file write, shell command, etc.), the bot pushes an inline keyboard with Approve/Deny buttons. The user taps to respond and OpenCode continues.

## Project Structure

```
src/
├── index.ts              # Entry point — init auth, start server, launch bot
├── config.ts             # Environment config loader
├── bot/
│   ├── bot.ts            # grammY bot setup, middleware chain
│   ├── commands/         # Command handlers
│   │   ├── start.ts      # /start — welcome + status
│   │   ├── help.ts       # /help — command reference
│   │   ├── sessions.ts   # /sessions, /new
│   │   ├── models.ts     # /models
│   │   ├── agent.ts      # /agent
│   │   ├── status.ts     # /status
│   │   ├── actions.ts    # /abort, /share, /fork, /compact, /undo, /stats, /project
│   │   └── auth.ts       # /auth, /grant, /revoke, /whoami
│   ├── keyboards/        # Inline keyboard builders
│   │   ├── sessions.ts   # Paginated session list
│   │   ├── models.ts     # Provider → model picker
│   │   ├── agents.ts     # Agent picker
│   │   └── actions.ts    # Message actions, confirm dialogs, permission buttons
│   ├── handlers/         # Callback query & message handlers
│   │   ├── callback.ts   # All callback query routing
│   │   ├── message.ts    # Plain text → OpenCode prompt
│   │   └── permission.ts # SSE permission events → inline keyboards
│   └── middleware/        # Middleware chain
│       ├── auth.ts       # Auth-store check (allows /start, /auth through)
│       ├── error.ts      # Global error handler
│       └── rate-limit.ts # 30 req/min per user sliding window
├── opencode/
│   ├── client.ts         # OpenCode HTTP API client
│   ├── events.ts         # SSE event stream listener with reconnect
│   ├── server.ts         # Server lifecycle management
│   └── types.ts          # TypeScript types for API responses
├── services/
│   ├── session.ts        # Per-user in-memory session state
│   ├── streaming.ts      # Response formatting and message splitting
│   └── auth-store.ts     # Persistent JSON auth store (.data/auth.json)
└── utils/
    ├── logger.ts         # Structured logging
    └── telegram.ts       # Escape markdown, split messages, format helpers
```

## Deployment

### systemd Service

```ini
[Unit]
Description=OpenCode Telegram Bot
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/opencode-telegram-bot
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
EnvironmentFile=/path/to/opencode-telegram-bot/.env

[Install]
WantedBy=multi-user.target
```

### Docker

```bash
docker build -t opencode-telegram-bot .
docker run -d --env-file .env --name opencode-bot opencode-telegram-bot
```

## Development

```bash
npm run dev      # Run with tsx watch mode
npm run build    # Compile TypeScript
npm run lint     # ESLint
npm test         # Run tests
```

## Security

### Authentication System

The bot uses a multi-layer authentication system:

1. **Seed users** — Telegram user IDs listed in `TELEGRAM_ALLOWED_USERS` are pre-authorized at startup. The first ID in the list is assigned the `owner` role; the rest get `user` role.
2. **PIN authentication** — New users can authenticate by sending `/auth <PIN>` with the PIN defined in `AUTH_PIN`. Once authenticated, they receive the `user` role.
3. **Owner grants** — The owner can promote or grant access to anyone via `/grant <user_id> [owner|user]`, and revoke access with `/revoke <user_id>`.

Auth data is persisted to `AUTH_DATA_DIR/auth.json` (default: `.data/auth.json`), so users remain authenticated across bot restarts.

### Brute Force Protection

- Max **5 failed PIN attempts** per user
- After 5 failures, the user is **locked out for 15 minutes**
- Failed attempt counters reset on successful authentication

### Rate Limiting

- **30 requests per 60-second** sliding window per user
- Applies to all authenticated users equally
- Exceeding the limit returns a "slow down" message with the retry wait time

### Other Protections

- **Local-only server** — OpenCode server binds to `127.0.0.1` by default, never exposed to the internet
- **No credential forwarding** — The bot never sends API keys, tokens, or passwords to Telegram
- **Input sanitization** — All user input is validated before being forwarded to OpenCode
- **Unauthenticated command filtering** — Only `/start` and `/auth` are accessible without authentication; all other commands and messages are blocked

## License

MIT
