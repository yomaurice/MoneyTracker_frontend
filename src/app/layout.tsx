import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Image from 'next/image'
import { CurrencyProvider } from '../context/CurrencyContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Money Tracker',
  description: 'Track expenses and income',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <CurrencyProvider>

          {/* App Header */}
          <header className="flex items-center gap-3 px-6 py-4 border-b bg-white">
            <Image
              src="/logo.png"
              alt="Money Tracker Logo"
              width={40}
              height={40}
              priority
            />
            <span className="text-xl font-semibold text-gray-800">
              Money Tracker
            </span>
          </header>

          {/* Page Content */}
          <main>
            {children}
          </main>

        </CurrencyProvider>
      </body>
    </html>
  )
}
