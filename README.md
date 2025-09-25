# GT Items Watcher Bot

[![CI](https://github.com/ravejoy/gtitems-watcher-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/ravejoy/gtitems-watcher-bot/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A Telegram bot that scans a listing website, walks through paginated pages, opens “reviews” pages for each site, and extracts item names.  
Built with **TypeScript**, **Telegraf**, and **Zod**. 

## Features

- Scan N listing pages and open each site's reviews page
- Parse item names and print only links that contain items
- Dedup review links
- Fast scanning via concurrency with simple progress updates
- Keyword **Search** mode with multi-keyword filtering
- Works in **polling** mode (both local and deploy)
- Modular architecture (bot/core/infra/lib) with unit tests

## Tech Stack

- Node.js + TypeScript
- Telegraf (Telegram Bot API)
- Zod (env/config validation)
- Vitest (unit tests)
- ESLint (flat config) + Prettier
- pino (structured logging)

---

## Quick Start (Local)

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
- After results, menu will appear again automatically.

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

## Deploy

### Option A: Background Worker (Docker-based)

1. Push your repo to GitHub.
2. CI/CD builds a Docker image and pushes it to GitHub Container Registry.
3. Create a **Background Worker** on **Render**, or on **Koyeb** (Free plan available), or use any similar platform.
4. Configure env vars:
   - `TELEGRAM_BOT_TOKEN`
   - `BASE_URL=https://example.com`
5. Deploy worker with the prebuilt Docker image.

### Option B: Docker (manual)

Run the same as CI/CD but manually:

```bash
docker build -t gtitems-bot .
docker run --rm -e TELEGRAM_BOT_TOKEN=xxx -e BASE_URL=https://example.com gtitems-bot
```

---

## Project Structure

```
src/
  bot/
    main.ts            # bot wiring (polling flows are initialized from index/server)
    handlers/          # scan, search, inputs
    state/             # in-memory chat settings
    ui/                # menu and texts
    utils/              # messaging helpers, chunking
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
```

- **Local polling** uses `src/index.ts`.

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

GitHub Actions run **lint**, **test**, **build**, and **deploy** via Docker to Render/Koyeb.  
See `.github/workflows/ci.yml`.

---

## License

MIT — see [LICENSE](LICENSE).
