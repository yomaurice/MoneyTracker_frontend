import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import ClientLayout from './ClientLayout';
import { CurrencyProvider } from '../context/CurrencyContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Money Tracker',
  description: 'Track expenses and income',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <CurrencyProvider>
            <ClientLayout>{children}</ClientLayout>
          </CurrencyProvider>
        </Providers>
      </body>
    </html>
  );
}
