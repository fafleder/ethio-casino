# 🎰 Ethio Casino - Telegram Mini App

A provably fair casino Telegram Mini App with 6 games: **Dice, Coin Flip, Slots, Crash, Plinko, Mines** + **Baccarat, Blackjack, Roulette, Sic Bo, Teen Patti, Andar Bahar** (Phase 2).

## 🎮 Features

- **Provably Fair**: Cryptographic verification on every bet
- **6 Games Ready**: Dice, Coin Flip, Slots, Crash, Plinko, Mines
- **Virtual Currency**: ETB (Ethiopian Birr) - demo balance 100 ETB
- **Daily Bonus**: Claim 100 ETB every 24 hours
- **Leaderboard**: Compete with other players
- **Game History**: Full betting history with filters
- **Telegram Web App**: Native Telegram experience

## 🏗️ Architecture

```
├── src/
│   ├── bot/           # Telegraf Telegram bot
│   ├── server/        # Express API server
│   ├── games/         # Game logic + provably fair engine
│   ├── database/      # SQLite (dev) / PostgreSQL (prod)
│   ├── config/        # Zod-validated config
│   └── utils/         # Helpers
├── miniapp/           # Frontend (HTML/CSS/JS)
├── sketches/          # Design mockups
└── docker/            # Docker deployment
```

## 🚀 Quick Start (Local)

```bash
# 1. Clone and install
cd ethio-auto-mini-app
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your bot token

# 3. Initialize database
npm run db:init

# 4. Start development
npm run start
# or separately:
# npm run dev    # Frontend (Vite)
# npm run bot    # Telegram bot (polling)
```

## 🎯 Games Implemented

| Game | RTP | House Edge | Type |
|------|-----|------------|------|
| Dice | 99% | 1% | Classic |
| Coin Flip | 98% | 2% | Instant |
| Slots | 95% | 5% | 3-Reel |
| Crash | 97% | 3% | Multiplier |
| Plinko | 96% | 4% | Peg Board |
| Mines | 97% | 3% | Strategy |

## 🔐 Provably Fair

Every game uses HMAC-SHA256 with server/client seeds:
1. Server generates seed → shows hash
2. Player provides client seed
3. Game uses `HMAC(serverSeed, clientSeed:nonce)`
4. After game, server reveals seed → verify anytime

## 📦 Deployment

### Railway (Recommended - 500h free/month)
```bash
# 1. Push to GitHub
git push origin main

# 2. Connect Railway → Deploy from GitHub
# 3. Add PostgreSQL database
# 4. Set env vars (see DEPLOY.md)
```

### Docker
```bash
docker-compose up -d
```

## 🛠️ Tech Stack

- **Bot**: Telegraf (TypeScript)
- **API**: Express + TypeScript
- **DB**: SQLite (dev) / PostgreSQL + pgvector (prod)
- **Frontend**: Vanilla JS + Tailwind (via CDN)
- **Fairness**: Web Crypto API (HMAC-SHA256)
- **Deploy**: Railway / Render / Fly.io / Docker

## 📁 Project Structure

```
ethio-auto-mini-app/
├── src/
│   ├── bot/index.ts           # Telegram bot commands
│   ├── server/index.ts        # Express API endpoints
│   ├── games/
│   │   ├── provably-fair.ts   # HMAC-SHA256 engine
│   │   └── game-service.ts    # Bet processing
│   ├── database/index.ts      # SQLite/Postgres adapter
│   └── config/index.ts        # Environment validation
├── miniapp/
│   ├── index.html             # Main Mini App
│   ├── css/main.css           # Casino theme
│   └── js/                    # Game clients
├── sketches/                  # Design mockups
├── Dockerfile
├── docker-compose.yml
├── railway.toml
└── DEPLOY.md
```

## 🎨 Design Previews

Open in browser:
- `sketches/001-casino-lobby/index.html` - Full lobby
- `sketches/002-quick-bet/index.html` - One-handed betting
- `sketches/003-crash-game/index.html` - Crash game

## 📝 License

MIT