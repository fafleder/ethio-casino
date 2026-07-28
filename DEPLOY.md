# Ethio Casino Mini App - Deployment Guide

## Option 1: Railway (Recommended - 500 hours/month free)

### Prerequisites
1. GitHub account
2. Railway account (https://railway.app)

### Steps

1. **Push to GitHub**
```bash
cd /c/Users/lenovo/ethio-auto-mini-app
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/ethio-casino.git
git push -u origin main
```

2. **Deploy on Railway**
   - Go to https://railway.app
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repo
   - Railway auto-detects Node.js

3. **Add PostgreSQL Database**
   - In Railway project: "New" → "Database" → "PostgreSQL"
   - Copy the DATABASE_URL from the database service

4. **Set Environment Variables** (in Railway → Variables):
```
BOT_TOKEN=8892760229:AAFcq9B9Bz3pyWLstU036sAJs3p2nUdVeV0
BOT_USERNAME=your_bot_username
WEBAPP_URL=https://your-app.railway.app
DATABASE_URL=postgresql://... (from Railway PostgreSQL)
NVIDIA_API_KEY=your_nvidia_key
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
OWNER_TELEGRAM_IDS=361695664
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

5. **Deploy** - Railway will auto-deploy on push

---

## Option 2: Render (Free tier with PostgreSQL)

1. **Push to GitHub** (same as above)

2. **Deploy on Render**
   - Go to https://render.com
   - "New" → "Web Service" → Connect GitHub repo
   - Build command: `npm install && npm run build`
   - Start command: `npm start`

3. **Add PostgreSQL**
   - "New" → "PostgreSQL" → Free tier

4. **Set Environment Variables** (same as Railway)

---

## Option 3: Fly.io (Free allowance)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Deploy
cd /c/Users/lenovo/ethio-auto-mini-app
fly launch
fly postgres create
fly secrets set BOT_TOKEN=... DATABASE_URL=... etc.
fly deploy
```

---

## Option 4: Local + ngrok (Quick testing)

```bash
# Install ngrok
npm install -g ngrok

# Start bot locally
npm run bot

# In another terminal
ngrok http 3000

# Use the ngrok URL as WEBAPP_URL
# Set webhook: curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=https://your-ngrok.ngrok.io/webhook"
```

---

## Database Migration (Local SQLite → PostgreSQL)

```bash
# 1. Export from SQLite (if using better-sqlite3)
sqlite3 data/casino.db .dump > dump.sql

# 2. Import to PostgreSQL
psql $DATABASE_URL < dump.sql

# Or use pgloader:
# pgloader sqlite://data/casino.db postgresql://user:pass@host/db
```

---

## Mini App Hosting

The Mini App frontend (in `miniapp/`) can be:
1. **Served by the same Express server** (current setup)
2. **Deployed separately** to:
   - Netlify/Vercel (free)
   - GitHub Pages (free)
   - Cloudflare Pages (free)

For separate deployment:
```bash
cd miniapp
npm run build
# Deploy dist/ folder to Netlify/Vercel
```

Then update `WEBAPP_URL` to the deployed frontend URL.

---

## Testing the Bot

1. **Start conversation**: Message your bot on Telegram
2. **Click "Play Games"** → Opens Mini App
3. **Test games**: Dice, Coin Flip, Slots, Crash, Plinko, Mines
4. **Check Provably Fair**: Verify any game result
5. **Daily Bonus**: Claim every 24 hours

---

## Monitoring

- **Railway**: Built-in logs and metrics
- **Render**: Logs dashboard
- **Health check**: `GET /health` endpoint
- **Bot status**: Check Telegram @BotFather for webhook status