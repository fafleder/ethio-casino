import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ethio Casino Bot | Provably Fair Games on Telegram',
  description: 'Play 6 provably fair casino games on Telegram. Dice, Coin Flip, Slots, Crash, Plinko, Mines with HMAC-SHA256 verification. Free to start.',
  openGraph: {
    title: 'Ethio Casino Bot | Provably Fair Games',
    description: '6 games, 95-99% RTP, instant withdrawals, provably fair',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}