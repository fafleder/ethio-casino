# PRD: Casino Bot Subscription Landing Page

## What it does
A single-page marketing site for @ethioaugames_bot that converts visitors into paid subscribers. Features:
- Hero with casino bot value prop (6 provably fair games, 95-99% RTP)
- Pricing tiers: Free (demo credits), Pro ($9.99/mo - unlimited play), VIP ($29.99/mo - higher limits + priority support)
- Stripe Checkout integration for subscriptions
- Supabase Auth (email/password + magic link)
- Post-payment redirect to Telegram deep link to start playing

## Who it helps
Telegram users in Ethiopia and global markets who want to play provably fair casino games (Dice, Coin Flip, Slots, Crash, Plinko, Mines) with transparent HMAC-SHA256 verification. Targets both casual players (Free tier) and high-volume players (Pro/VIP).

## What you charge
- **Free**: 100 demo credits/day, all 6 games, no withdrawals
- **Pro ($9.99/mo)**: Unlimited credits, all games, withdrawals enabled, 2% cashback
- **VIP ($29.99/mo)**: Pro features + higher bet limits, priority support, exclusive games access, 5% cashback

## Tech Stack
- **Framework**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Auth**: Supabase Auth (email/password, magic link)
- **Payments**: Stripe Checkout (subscription mode)
- **Database**: Supabase Postgres (user profiles, subscription status)
- **Deploy**: Vercel (free tier)
- **Domain**: Custom domain via Vercel

## Pages
1. `/` — Landing page (hero, features, pricing, FAQ, footer)
2. `/auth` — Supabase Auth (login/signup/reset)
3. `/checkout?price_id=...` — Stripe Checkout redirect
4. `/success?session_id=...` — Post-payment success, redirect to Telegram bot
5. `/dashboard` — Protected user area (subscription status, manage billing)

## Success Criteria
- [ ] Live on Vercel with custom domain
- [ ] Stripe test mode processes subscription successfully
- [ ] Supabase Auth creates user + stores subscription tier
- [ ] Success page redirects to `https://t.me/ethioaugames_bot?start=paid_{user_id}`
- [ ] Mobile responsive, loads <3s

## Out of Scope (v1)
- Admin dashboard
- Referral/affiliate system
- Webhooks for subscription cancellation (handle manually first)
- Email marketing integration