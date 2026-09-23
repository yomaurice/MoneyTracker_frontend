'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import AddTransaction, {
  TransactionPayload,
} from '@/components/AddTransaction';
import LoginModal from '@/components/LoginModal';
import { authFetch } from '@/utils/auth_fetch';
import { getApiBaseUrl } from '@/utils/api_base';

type QueueItem = {
  id: number;
  state: string;
  source: string;
  date: string | null;
  amount: number | null;
  currency: string | null;
  type: string | null;
  merchant_raw: string | null;
  merchant_clean: string | null;
  memo: string | null;
  installment_no: number | null;
  installment_total: number | null;
  match_score: number | null;
  candidate_ids: number[] | null;
  suggested_category: string | null;
  suggested_description: string | null;
  category_confidence: number | null;
  position: number;
  total: number;
};

export default function ReviewPage() {
  const router = useRouter();

  const [items, setItems] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [done, setDone] = useState(0);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`${getApiBaseUrl()}/api/review/queue`);
      if (res.status === 401) {
        setNeedsLogin(true);
        return;
      }
      if (!res.ok) {
        setError('Could not load the review queue.');
        return;
      }
      const body = await res.json();
      setItems(body.items || []);
      setIndex(0);
    } catch {
      setError('Network error. The server may still be waking up.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const current = items[index];
  const remaining = items.length - index;

  /** Move to the next charge. `saved` distinguishes a confirm from a skip. */
  const advance = useCallback((saved: boolean) => {
    if (saved) setDone(d => d + 1);
    setIndex(i => i + 1);
  }, []);

  /**
   * Confirm through the review endpoint rather than creating a bare
   * transaction, so the staged row is marked confirmed and the merchant rule
   * is learned in the same commit.
   */
  const confirm = useCallback(
    async (payload: TransactionPayload) => {
      if (!current) return { ok: false, message: 'Nothing to save' };

      const res = await authFetch(`${getApiBaseUrl()}/api/review/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: current.id, ...payload }] }),
      });

      if (res.status === 401) {
        // Keep the page and the edits; ask for a password in place.
        setNeedsLogin(true);
        return { ok: false, message: 'Sign in to save this one.' };
      }

      if (res.ok) return { ok: true, message: 'Saved' };

      const body = await res.json().catch(() => ({}));
      // Confirm rejects the whole batch on any invalid row, so surface the
      // reason here rather than letting the user discover it later.
      const detail = body.errors?.[0]?.error || body.message;
      return { ok: false, message: detail || 'Could not save' };
    },
    [current],
  );

  const skip = useCallback(async () => {
    if (!current) return;
    try {
      const res = await authFetch(`${getApiBaseUrl()}/api/review/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [current.id] }),
      });
      if (res.status === 401) {
        setNeedsLogin(true);
        return;
      }
    } catch {
      // A failed skip is not worth blocking on; it will reappear next time.
    }
    advance(false);
  }, [current, advance]);

  const skipAll = useCallback(async () => {
    const ids = items.slice(index).map(i => i.id);
    if (!ids.length) return;
    try {
      await authFetch(`${getApiBaseUrl()}/api/review/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
    } catch {
      /* same as skip */
    }
    setIndex(items.length);
  }, [items, index]);

  if (needsLogin) {
    return (
      <LoginModal
        reason="Your session expired. Sign in to carry on reviewing."
        onSuccess={() => {
          setNeedsLogin(false);
          loadQueue();
        }}
      />
    );
  }

  if (loading) {
    return <Centered>Loading the review queue…</Centered>;
  }

  if (error) {
    return (
      <Centered>
        <p className="mb-4 text-red-600">{error}</p>
        <button onClick={loadQueue} className="text-blue-600 hover:underline">
          Try again
        </button>
      </Centered>
    );
  }

  if (!items.length) {
    return (
      <Centered>
        <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
          Nothing to review
        </h1>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Every charge we have seen is already accounted for.
        </p>
        <button onClick={() => router.push('/')} className="text-blue-600 hover:underline">
          Back to the dashboard
        </button>
      </Centered>
    );
  }

  if (!current) {
    return (
      <Centered>
        <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
          Review complete
        </h1>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          {done} {done === 1 ? 'transaction' : 'transactions'} added.
        </p>
        <div className="flex justify-center gap-4">
          <button onClick={loadQueue} className="text-blue-600 hover:underline">
            Check for more
          </button>
          <button onClick={() => router.push('/')} className="text-blue-600 hover:underline">
            Back to the dashboard
          </button>
        </div>
      </Centered>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4">
      <ChargeCard item={current} />

      <AddTransaction
        // Remount per row so the form cannot carry state between charges.
        key={current.id}
        initialValues={{
          type: current.type || 'expense',
          category: current.suggested_category || '',
          amount: current.amount ?? '',
          description: current.suggested_description || '',
          date: current.date || undefined,
          currency: current.currency || undefined,
        }}
        progress={{ current: current.position, total: current.total }}
        submitLabel="Save & Next"
        onSubmit={confirm}
        onSaved={() => advance(true)}
        onSkip={skip}
      />

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          {remaining} left in this batch
        </span>
        <button onClick={skipAll} className="text-gray-500 hover:underline">
          Skip all
        </button>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">{children}</div>
  );
}

/** What the bank or card actually reported, kept visible while editing. */
function ChargeCard({ item }: { item: QueueItem }) {
  const confidence = item.category_confidence ?? 0;

  return (
    <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700
                    bg-gray-50 dark:bg-gray-800 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-gray-800 dark:text-gray-100">
            {item.merchant_clean || item.merchant_raw || 'Unknown merchant'}
          </p>
          {item.merchant_raw && item.merchant_raw !== item.merchant_clean && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              as reported: {item.merchant_raw}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {item.date} · from {item.source}
            {item.installment_total
              ? ` · instalment ${item.installment_no}/${item.installment_total}`
              : ''}
          </p>
        </div>
        <p className="whitespace-nowrap text-lg font-bold text-gray-800 dark:text-gray-100">
          {item.amount} {item.currency}
        </p>
      </div>

      {item.state === 'ambiguous' && (
        <p className="mt-3 rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-900">
          More than one tracked transaction could be this charge, so it was not
          matched automatically. Saving it will create a new transaction — only
          do that if this is genuinely a separate charge.
        </p>
      )}

      {item.state === 'proposed' && confidence === 0 && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          No category guess for this merchant yet — pick one and it will be
          remembered next time.
        </p>
      )}
    </div>
  );
}
