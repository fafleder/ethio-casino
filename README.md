# Ethio Casino Subscription Landing Page

A Next.js 14 landing page for @ethioaugames_bot with Supabase Auth and Stripe Checkout subscriptions.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Copy `.env.example` to `.env.local` and fill in your values:
```bash
cp .env.example .env.local
```

Required services:
- **Supabase**: Create project at supabase.com, get URL and keys from Settings > API
- **Stripe**: Create account at stripe.com, get keys from Developers > API keys
  - Create two recurring prices: Pro ($9.99/mo) and VIP ($29.99/mo)
  - Add webhook endpoint: `https://your-domain.vercel.app/api/webhook` for `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

### 3. Set Up Supabase Database
Run the SQL in `supabase/schema.sql` in your Supabase SQL Editor.

### 4. Run Locally
```bash
npm run dev
```
Visit `http://localhost:3000`

## Deploy to Vercel

### Option 1: Vercel CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

### Option 2: GitHub + Vercel Dashboard
1. Push to GitHub
2. Import in Vercel dashboard
3. Add environment variables from `.env.example`
4. Deploy

## Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── checkout/route.ts       # Create Stripe Checkout session
│   │   ├── checkout/verify/route.ts # Verify payment, update tier
│   │   └── webhook/route.ts        # Stripe webhooks
│   ├── auth/page.tsx               # Login/Signup with magic link
│   ├── checkout/page.tsx           # Redirect to Stripe
│   ├── success/page.tsx            # Post-payment, redirect to Telegram
│   ├── dashboard/page.tsx          # Protected user dashboard
│   ├── layout.tsx                  # Root layout
│   └── page.tsx                    # Landing page
├── lib/
│   ├── constants.ts                # Games & features data
│   ├── stripe.ts                   # Stripe helpers
│   ├── supabase-client.ts          # Browser Supabase client
│   └── supabase-server.ts          # Server Supabase client
└── types/
    └── subscription.ts             # Tier types & user profile

supabase/
└── schema.sql                      # Database schema + RLS
```

## Subscription Tiers

| Tier | Price | Credits | Max Bet | Withdrawals | Cashback |
|------|-------|---------|---------|-------------|----------|
| Free | $0 | 100/day | $10 | ❌ | 0% |
| Pro | $9.99/mo | Unlimited | $1,000 | ✅ | 2% |
| VIP | $29.99/mo | Unlimited | $10,000 | ✅ | 5% |

## Telegram Integration

After successful payment, users are redirected to:
```
https://t.me/ethioaugames_bot?start=paid_{user_id}
```

Your bot should handle this deep link and credit the user's account.

## Custom Domain

In Vercel dashboard: Settings > Domains > Add your domain.

## License

MIT