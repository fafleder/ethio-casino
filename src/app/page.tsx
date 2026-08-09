'use client'

import Link from 'next/link'
import { games, features } from '@/lib/constants'

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/5 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎰</span>
              <span className="font-bold text-xl gradient-gold">Ethio Casino</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <Link href="#features" className="text-gray-300 hover:text-yellow-400 transition">Features</Link>
              <Link href="#games" className="text-gray-300 hover:text-yellow-400 transition">Games</Link>
              <Link href="#pricing" className="text-gray-300 hover:text-yellow-400 transition">Pricing</Link>
              <Link href="/auth" className="btn-primary text-sm">Get Started</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-2 mb-8">
              <span className="text-sm font-medium text-yellow-400">🎁 100 Free Credits Daily</span>
              <span className="text-sm text-gray-400">No deposit required</span>
            </div>
            <h1 className="text-5xl sm:text-7xl font-bold mb-6 leading-tight">
              Provably Fair Casino
              <br />
              <span className="gradient-gold">on Telegram</span>
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 mb-10 max-w-3xl mx-auto text-balance">
              Play 6 casino games with HMAC-SHA256 verification. 
              Dice • Coin Flip • Slots • Crash • Plinko • Mines
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/auth" 
                className="btn-primary text-lg px-10 py-4 w-full sm:w-auto"
              >
                Start Playing Free
              </Link>
              <Link 
                href="#pricing" 
                className="btn-secondary text-lg px-10 py-4 w-full sm:w-auto"
              >
                View Pricing
              </Link>
            </div>
            <p className="mt-6 text-gray-500 text-sm">
              Join 10,000+ players • No download • Instant play in Telegram
            </p>
          </div>

          {/* Trust indicators */}
          <div className="mt-20 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold gradient-gold">6</div>
              <div className="text-gray-500 text-sm">Games</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold gradient-gold">99%</div>
              <div className="text-gray-500 text-sm">Max RTP</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold gradient-gold">🔐</div>
              <div className="text-gray-500 text-sm">Provably Fair</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why Ethio Casino?</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Built for players who value transparency, fairness, and speed
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <div key={i} className="card-glass p-6 hover:border-yellow-500/50 transition-colors">
                <h3 className="text-xl font-bold mb-2 gradient-gold">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Games Section */}
      <section id="games" className="py-20 px-4 sm:px-6 lg:px-8 bg-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Our Games</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              6 provably fair games with industry-leading RTP
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map((game, i) => (
              <div key={i} className="card-glass p-6 hover:border-yellow-500/50 transition-colors">
                <div className="text-4xl mb-4">{game.icon}</div>
                <h3 className="text-xl font-bold mb-2">{game.name}</h3>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-yellow-400 font-bold text-lg">{game.rtp} RTP</span>
                </div>
                <p className="text-gray-400 text-sm">{game.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Start free, upgrade when you're ready. No hidden fees.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { tier: 'free', name: 'Free', price: 0, features: ['100 demo credits/day', 'All 6 games', 'Provably fair verification', 'No withdrawals'], cta: 'Start Free', popular: false },
              { tier: 'pro', name: 'Pro', price: 9.99, features: ['Unlimited credits', 'All 6 games + new releases', 'Withdrawals enabled', '2% cashback', 'Priority support'], cta: 'Get Pro', popular: true },
              { tier: 'vip', name: 'VIP', price: 29.99, features: ['Unlimited credits', 'Exclusive VIP games', 'Higher bet limits ($10k)', '5% cashback', '24/7 personal manager', 'Early access'], cta: 'Get VIP', popular: false },
            ].map((plan) => (
              <div 
                key={plan.tier} 
                className={`relative card-glass p-8 ${plan.popular ? 'border-yellow-500/50 ring-2 ring-yellow-500/20' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-gray-900 text-xs font-bold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-5xl font-bold gradient-gold">${plan.price}</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-300">
                      <span className="text-yellow-400">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link 
                  href={`/auth?plan=${plan.tier}`}
                  className={`w-full text-center py-3 rounded-lg font-semibold transition-all ${
                    plan.popular 
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 hover:from-yellow-400 hover:to-orange-400'
                      : 'border-2 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/5">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">Frequently Asked</h2>
          <dl className="space-y-6">
            {[
              { q: 'What does "provably fair" mean?', a: 'Every game result is generated using HMAC-SHA256 with a server seed and client seed. You can verify every bet yourself — the casino cannot manipulate results.' },
              { q: 'How do I withdraw my winnings?', a: 'Pro and VIP tiers enable instant withdrawals to your Telegram wallet. No minimums, no KYC for amounts under $1,000.' },
              { q: 'Can I change my plan later?', a: 'Yes! Upgrade or downgrade anytime from your dashboard. Changes take effect at the next billing cycle.' },
              { q: 'What languages are supported?', a: 'Amharic, English, Oromo, and Tigrinya. The bot detects your Telegram language automatically.' },
              { q: 'Is there a referral program?', a: 'Coming soon! VIP members get early access to the affiliate program with 20% lifetime commissions.' },
            ].map((faq, i) => (
              <div key={i} className="card-glass p-6">
                <dt className="font-semibold text-lg mb-2">{faq.q}</dt>
                <dd className="text-gray-400">{faq.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🎰</span>
                <span className="font-bold text-xl gradient-gold">Ethio Casino</span>
              </div>
              <p className="text-gray-500 text-sm">Provably fair casino games on Telegram</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Games</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>Dice (99% RTP)</li>
                <li>Coin Flip (98% RTP)</li>
                <li>Slots (95% RTP)</li>
                <li>Crash (97% RTP)</li>
                <li>Plinko (96% RTP)</li>
                <li>Mines (97% RTP)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Links</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="https://t.me/ethioaugames_bot" target="_blank" className="hover:text-yellow-400">Play on Telegram</a></li>
                <li><a href="/auth" className="hover:text-yellow-400">Account</a></li>
                <li><a href="#pricing" className="hover:text-yellow-400">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>Email: support@ethiocasino.com</li>
                <li>Telegram: @ethioaugames_support</li>
                <li>24/7 for VIP members</li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 text-center text-gray-500 text-sm">
            © 2024 Ethio Casino. Provably fair gaming on Telegram.
          </div>
        </div>
      </footer>
    </div>
  )
}