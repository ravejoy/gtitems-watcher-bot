# GT Items Watcher Bot

A Telegram bot that scans a listing website, walks through paginated pages, opens “reviews” pages for each site, and extracts item names.  
Built with **TypeScript**, **Telegraf**, and **Zod**. Designed to be clean and portfolio-friendly.

## Features

- Scan N listing pages and open each site's reviews page
- Parse item names and print only links that contain items
- Dedup review links
- Fast scanning via concurrency with simple progress updates
- Keyword **Search** mode with multi-keyword filtering
- Works in **polling** (local) and **webhook** (deploy) modes
- Modular architecture (bot/core/infra/lib) with unit tests

## Tech Stack

- Node.js + TypeScript
- Telegraf (Telegram Bot API)
- Zod (env/config validation)
- Vitest (unit tests)
- ESLint (flat config) + Prettier
- pino (structured logging)

---

## Quick Start (Local, Polling Mode)

### Prerequisites

- Node.js 20+
- npm 9+

### Setup

```bash
git clone https://github.com/ravejoy/gtitems-watcher-bot.git
cd gtitems-watcher-bot
npm install
cp .env.example .env
```

Edit `.env`:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
BASE_URL=https://example.com
```

Start in polling mode:

```bash
npm run dev
```

Now open your bot in Telegram and type `/start`.

---

## Commands / UX

- **Scan**: scans configured number of pages and prints only links that actually contain items.
- **Search**: filters items by keywords (supports multiple keywords).
- **Pages**: set how many listing pages to scan (1..100).
- After results, you’ll see: **“Type /start to continue”**.

---

## Tests

```bash
npm test
npm run test:cov
```

Tests are organized by domain:

```
tests/
  bot/
  core/
  infra/
```

---

## Deploy (Webhook Mode)

### Option A: Render (recommended)

1. Push your repo to GitHub.
2. Create a **Web Service** on Render (Free plan is fine for a pet/portfolio).
3. Set env vars:
   - `TELEGRAM_BOT_TOKEN`
   - `BASE_URL` — root of the target website
   - Optional: `PUBLIC_URL` — your public service URL (Render provides `RENDER_EXTERNAL_URL` automatically)
4. Render will build and start the app using `render.yaml`.

The server sets the Telegram webhook automatically to:

```
<PUBLIC_URL>/webhook/<TELEGRAM_BOT_TOKEN>
```

Health check: `GET /healthz` → `200 ok`.

### Option B: Docker

Build and run:

```bash
docker build -t gtitems-bot .
docker run --rm -p 10000:10000   -e TELEGRAM_BOT_TOKEN=xxx   -e BASE_URL=https://example.com   -e PUBLIC_URL=http://localhost:10000   gtitems-bot
```

Compose:

```bash
docker-compose up --build
```

---

## Project Structure

```
src/
  bot/
    main.ts            # bot wiring (webhook/polling flows are initialized from index/server)
    handlers/          # scan, search, inputs
    state/             # in-memory chat settings
    ui/                # menu and texts
    util/              # messaging helpers, chunking
  core/
    ports/             # abstractions
    services/          # page scanning service
    utils/             # keyword parsing, etc.
  infra/
    http-client.ts
    review-link-extractor.ts
    fragment-source.ts
    xml-fragment-item-parser.ts
  lib/
    env.ts
    logger.ts
tests/
  bot/ core/ infra/
```

---

## Environment

`.env.example`:

```
NODE_ENV=development
LOG_LEVEL=info
TELEGRAM_BOT_TOKEN=
BASE_URL=https://example.com
# PUBLIC_URL is optional in deploys; if omitted, server uses platform-provided public URL when available.
# PUBLIC_URL=https://your-service.example.com
```

- **Local polling** uses `src/index.ts`.
- **Webhook server** uses `src/server.ts` (Express).

---

## Scripts

```json
{
  "build": "tsc -p .",
  "start": "node dist/index.js",
  "start:server": "node dist/server.js",
  "dev": "tsx src/index.ts",
  "lint": "eslint . --ext .ts",
  "format": "prettier --write .",
  "test": "vitest run",
  "test:cov": "vitest run --coverage"
}
```

---

## CI

GitHub Actions run **lint**, **test**, and **build** in parallel.  
See `.github/workflows/ci.yml`.

---

## License

MIT — see [LICENSE](LICENSE).
