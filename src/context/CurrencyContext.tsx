'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const defaultCurrency = 'ILS';

const CurrencyContext = createContext({
  currency: defaultCurrency,
  setCurrency: (value: string) => {},
  amountDisplayMode: 'display' as 'display' | 'entry',
  setAmountDisplayMode: (value: 'display' | 'entry') => {},
});

export const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const [currency, setCurrency] = useState(defaultCurrency);
  const [amountDisplayMode, setAmountDisplayMode] = useState<'display' | 'entry'>('display');

  useEffect(() => {
    const stored = localStorage.getItem('selectedCurrency');
    if (stored) setCurrency(stored);
    const storedMode = localStorage.getItem('amountDisplayMode') as 'display' | 'entry' | null;
    if (storedMode) setAmountDisplayMode(storedMode);
  }, []);

  useEffect(() => {
    localStorage.setItem('selectedCurrency', currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem('amountDisplayMode', amountDisplayMode);
  }, [amountDisplayMode]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, amountDisplayMode, setAmountDisplayMode }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
