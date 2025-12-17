'use client'

import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Image from 'next/image'
import { CurrencyProvider, useCurrency } from '../context/CurrencyContext'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

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
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const [showSettings, setShowSettings] = useState(false)

  // ---------- APPLY THEME ----------
  useEffect(() => {
    const root = document.documentElement

    const applyTheme = () => {
      if (theme === 'dark') root.classList.add('dark')
      else if (theme === 'light') root.classList.remove('dark')
      else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.toggle('dark', prefersDark)
      }
    }

    applyTheme()
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const saved = localStorage.getItem('theme') as any
    if (saved) setTheme(saved)
  }, [])

  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-900`}>
        <CurrencyProvider>

          {/* ---------- HEADER ---------- */}
          <header className="border-b bg-white dark:bg-gray-800">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">

              {/* Brand */}
              <div className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="Money Tracker Logo"
                  width={44}
                  height={44}
                  priority
                />
                <span className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  Money Tracker
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                  ⚙ Settings
                </button>
              </div>

            </div>
          </header>

          {/* ---------- PAGE TRANSITIONS ---------- */}
          <main className="py-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={typeof window !== 'undefined' ? location.pathname : 'page'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* ---------- SETTINGS MODAL ---------- */}
          {showSettings && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 w-full max-w-sm">
                <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
                  Settings
                </h2>

                {/* Theme selector */}
                <div className="mb-6">
                  <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">
                    Theme
                  </label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as any)}
                    className="w-full p-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
                {/* Currency selector */}
                <div className="mb-6">
                  <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full p-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="ILS">ILS (₪)</option>
                  </select>
                </div>


                <div className="flex justify-end">
                  <button
                    onClick={() => setShowSettings(false)}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

        </CurrencyProvider>
      </body>
    </html>
  )
}
