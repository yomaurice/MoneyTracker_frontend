'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCurrency } from '../context/CurrencyContext';
import { usePathname } from 'next/navigation';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [showSettings, setShowSettings] = useState(false);

  const { currency, setCurrency } = useCurrency();
  const pathname = usePathname();

  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot') ||
    pathname.startsWith('/reset');

  // ---------------- THEME HANDLING ----------------
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') root.classList.add('dark');
    else if (theme === 'light') root.classList.remove('dark');
    else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const saved = localStorage.getItem('theme') as any;
    if (saved) setTheme(saved);
  }, []);

  return (
    <>
      {/* ---------------- HEADER ---------------- */}
      <header className="border-b bg-white dark:bg-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo (always visible) */}
          <div className="relative w-44 h-12">
            <Image
              src="/logo.png"
              alt="Money Tracker Logo"
              fill
              priority
              className="object-contain scale-125"
            />
          </div>

          {/* Settings (hidden on auth pages) */}
          {!isAuthPage && (
            <button
              onClick={() => setShowSettings(true)}
              className="px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-700"
            >
              ⚙ Settings
            </button>
          )}
        </div>
      </header>

      {/* ---------------- PAGE TRANSITIONS ---------------- */}
      <main className="py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ---------------- SETTINGS MODAL ---------------- */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-4">Settings</h2>

            {/* Theme */}
            <div className="mb-6">
              <label className="block text-sm mb-2">Theme</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="w-full p-2 rounded-lg border"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>

            {/* Currency */}
            <div className="mb-6">
              <label className="block text-sm mb-2">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full p-2 rounded-lg border"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="ILS">ILS (₪)</option>
              </select>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full bg-blue-600 text-white py-2 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
