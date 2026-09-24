'use client';

import { useEffect, useState } from 'react';

import { authFetch } from '@/utils/auth_fetch';
import { getApiBaseUrl } from '@/utils/api_base';

export type FoundTransaction = {
  id: number;
  date: string;
  amount: number;
  currency: string;
  type: string;
  category: string;
  description: string | null;
};

/**
 * Search tracked transactions by month, text, amount and type.
 *
 * Used beside the review wizard, where deciding whether a statement line is
 * already tracked means looking at that month, and on its own page. With
 * `onPick`, each row gets a "This one" button that links the charge to it.
 */
export default function TransactionFinder({
  month: initialMonth,
  amount: nearAmount,
  onPick,
  pickLabel = 'This one',
}: {
  /** YYYY-MM to open on. */
  month?: string;
  /** Offered as a one-click "near this amount" filter. */
  amount?: number | null;
  onPick?: (txn: FoundTransaction) => void;
  pickLabel?: string;
}) {
  const [month, setMonth] = useState(initialMonth || currentMonth());
  const [q, setQ] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('');
  const [items, setItems] = useState<FoundTransaction[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Follow the wizard to the next charge's month, and drop the previous
  // charge's amount filter, which would hide everything for this one.
  useEffect(() => {
    if (initialMonth) setMonth(initialMonth);
    setAmount('');
  }, [initialMonth, nearAmount]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (q.trim()) params.set('q', q.trim());
    if (amount.trim()) params.set('amount', amount.trim());
    if (type) params.set('type', type);

    let cancelled = false;
    // Debounced, so typing a description does not fire a request per key.
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const res = await authFetch(
          `${getApiBaseUrl()}/api/transactions/search?${params}`,
        );
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(body.message || 'Could not load transactions.');
          return;
        }
        setItems(body.items || []);
        setTruncated(!!body.truncated);
      } catch {
        if (!cancelled) setError('Network error.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [month, q, amount, type]);

  const expenses = items
    .filter(i => i.type === 'expense')
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700
                    bg-white dark:bg-gray-800 p-4">
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          aria-label="Month"
          className={INPUT}
        />
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Description or category"
          aria-label="Search description or category"
          className={`${INPUT} sm:col-span-2`}
        />
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          aria-label="Type"
          className={INPUT}
        >
          <option value="">All types</option>
          <option value="expense">Expenses</option>
          <option value="income">Income</option>
        </select>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Amount (±2)"
          aria-label="Amount, within 2"
          className={INPUT}
        />
        {nearAmount != null && (
          <button
            type="button"
            onClick={() => setAmount(String(nearAmount))}
            className="rounded-md bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs
                       text-gray-700 dark:text-gray-200 hover:bg-gray-200"
          >
            Near {nearAmount}
          </button>
        )}
        {(q || amount || type) && (
          <button
            type="button"
            onClick={() => { setQ(''); setAmount(''); setType(''); }}
            className="text-xs text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mb-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {loading ? 'Loading…' : `${items.length} transactions`}
          {truncated && ' (showing the first 1000 — narrow the filter)'}
        </span>
        <span>Expenses: {expenses.toFixed(2)}</span>
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="max-h-[28rem] overflow-y-auto">
        <table className="w-full text-sm">
          <tbody>
            {items.map(t => (
              <tr
                key={t.id}
                className="border-t border-gray-100 dark:border-gray-700 align-top"
              >
                <td className="whitespace-nowrap py-1.5 pr-2 text-gray-500 dark:text-gray-400">
                  {t.date.slice(5)}
                </td>
                <td className="py-1.5 pr-2 text-gray-800 dark:text-gray-100">
                  {t.description || <span className="text-gray-400">—</span>}
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t.category}
                  </div>
                </td>
                <td
                  className={`whitespace-nowrap py-1.5 pr-2 text-right font-medium ${
                    t.type === 'income' ? 'text-green-700' : 'text-gray-800 dark:text-gray-100'
                  }`}
                >
                  {t.amount.toFixed(2)} {t.currency !== 'ILS' ? t.currency : ''}
                </td>
                {onPick && (
                  <td className="py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => onPick(t)}
                      className="whitespace-nowrap rounded-md border border-blue-600 px-2 py-0.5
                                 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700"
                    >
                      {pickLabel}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!loading && !items.length && (
              <tr>
                <td className="py-6 text-center text-gray-500" colSpan={4}>
                  Nothing matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const INPUT =
  'rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 ' +
  'px-2 py-1 text-sm text-gray-800 dark:text-gray-100';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
