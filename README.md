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
                                   ▼
                            ┌──────────────┐
                            │  State Store  │
                            │  (in-memory)  │
                            └──────────────┘
```

The bot runs alongside the OpenCode server on the same machine. Communication happens over `localhost` via OpenCode's REST API and SSE event stream.

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize bot, show welcome and current status |
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
TELEGRAM_ALLOWED_USERS=123456789,987654321

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
| `TELEGRAM_ALLOWED_USERS` | Yes | — | Comma-separated Telegram user IDs |
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
├── index.ts              # Entry point
├── config.ts             # Environment config loader
├── bot/
│   ├── bot.ts            # grammY bot setup, middleware
│   ├── commands/         # Command handlers
│   │   ├── start.ts
│   │   ├── sessions.ts
│   │   ├── models.ts
│   │   ├── agent.ts
│   │   ├── project.ts
│   │   ├── status.ts
│   │   └── ...
│   ├── keyboards/        # Inline keyboard builders
│   │   ├── sessions.ts
│   │   ├── models.ts
│   │   ├── agents.ts
│   │   └── actions.ts
│   ├── handlers/         # Callback query & message handlers
│   │   ├── callback.ts
│   │   ├── message.ts
│   │   └── permission.ts
│   └── middleware/        # Auth, rate limit, error handling
│       ├── auth.ts
│       └── error.ts
├── opencode/
│   ├── client.ts         # OpenCode HTTP API client
│   ├── events.ts         # SSE event stream listener
│   ├── server.ts         # Server lifecycle management
│   └── types.ts          # TypeScript types for API responses
├── services/
│   ├── session.ts        # Session state management
│   ├── streaming.ts      # Response streaming with throttle
│   └── formatter.ts      # Markdown/message formatting
└── utils/
    ├── logger.ts         # Structured logging
    └── telegram.ts       # Telegram helpers (split messages, escape markdown)
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

- **User whitelist**: Only configured Telegram user IDs can interact with the bot
- **Local-only server**: OpenCode server binds to localhost by default
- **No credential forwarding**: Bot never exposes API keys or passwords to Telegram
- **Input sanitization**: All user input is validated before forwarding

## License

MIT
