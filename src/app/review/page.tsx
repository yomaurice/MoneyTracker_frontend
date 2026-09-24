'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import AddTransaction, {
  TransactionPayload,
} from '@/components/AddTransaction';
import LoginModal from '@/components/LoginModal';
import TransactionFinder, {
  FoundTransaction,
} from '@/components/TransactionFinder';
import { authFetch } from '@/utils/auth_fetch';
import { getApiBaseUrl } from '@/utils/api_base';

type Candidate = FoundTransaction;

type QueueItem = {
  id: number;
  state: string;
  source: string;
  date: string | null;
  posted_date: string | null;
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
  candidates: Candidate[];
  raw_cells: string[];
  suggested_category: string | null;
  suggested_description: string | null;
  category_confidence: number | null;
};

export default function ReviewPage() {
  const router = useRouter();

  const [items, setItems] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  const api = useCallback(
    async (path: string, body?: unknown) => {
      const res = await authFetch(`${getApiBaseUrl()}/api/review/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 401) {
        setNeedsLogin(true);
        return null;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Something went wrong.');
        return null;
      }
      return data;
    },
    [],
  );

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const body = await api('queue');
      if (!body) return;
      setItems(body.items || []);
      setSkipped(body.skipped || 0);
      setIndex(0);
    } catch {
      setError('Network error. The server may still be waking up.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const current = items[index];
  const remaining = items.length - index;

  /** Move to the next charge, with a short note about what just happened. */
  const advance = useCallback((note: string, saved = false) => {
    if (saved) setDone(d => d + 1);
    setNotice(note);
    setError('');
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

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  /** "It's this one": link the charge to a tracked transaction. */
  const link = useCallback(
    (txn: FoundTransaction) =>
      run(async () => {
        if (!current) return;
        const body = await api('link', { id: current.id, transaction_id: txn.id });
        if (body) advance(`Linked to “${txn.description || txn.category}”.`);
      }),
    [current, api, advance, run],
  );

  const alreadyIn = useCallback(
    () =>
      run(async () => {
        if (!current) return;
        const body = await api('already', { id: current.id });
        if (body) advance('Marked as already in.');
      }),
    [current, api, advance, run],
  );

  const skip = useCallback(
    () =>
      run(async () => {
        if (!current) return;
        const body = await api('skip', { ids: [current.id] });
        if (body) {
          setSkipped(s => s + 1);
          advance('Skipped. “Back” brings it back.');
        }
      }),
    [current, api, advance, run],
  );

  /** Pull the most recently skipped charge back in, right here. */
  const back = useCallback(
    () =>
      run(async () => {
        const body = await api('unskip', { latest: true });
        const restored: QueueItem | undefined = body?.items?.[0];
        if (!restored) return;
        // Skipped earlier in this session, it is still in the list behind the
        // cursor; move it rather than showing it twice.
        const before = items.slice(0, index).filter(i => i.id !== restored.id);
        const after = items.slice(index).filter(i => i.id !== restored.id);
        setItems([...before, restored, ...after]);
        setIndex(before.length);
        setSkipped(s => Math.max(0, s - 1));
        setNotice('Back to the last one you skipped.');
      }),
    [api, items, index, run],
  );

  const reviewSkipped = useCallback(
    () =>
      run(async () => {
        const body = await api('unskip', { all: true });
        if (body) await loadQueue();
      }),
    [api, loadQueue, run],
  );

  const recheck = useCallback(
    () =>
      run(async () => {
        const body = await api('rematch', {});
        if (!body) return;
        await loadQueue();
        setNotice(
          body.matched
            ? `${body.matched} more matched to existing transactions.`
            : 'No new matches.',
        );
      }),
    [api, loadQueue, run],
  );

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

  if (!items.length || !current) {
    const finished = items.length > 0;
    return (
      <Centered>
        <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
          {finished ? 'Review complete' : 'Nothing to review'}
        </h1>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          {finished
            ? `${done} ${done === 1 ? 'transaction' : 'transactions'} added.`
            : 'Every charge we have seen is accounted for.'}
        </p>
        {error && <p className="mb-4 text-red-600">{error}</p>}
        <div className="flex flex-wrap justify-center gap-4">
          {skipped > 0 && (
            <button onClick={reviewSkipped} disabled={busy}
                    className="text-blue-600 hover:underline">
              Go over the {skipped} skipped
            </button>
          )}
          {finished && (
            <button onClick={loadQueue} className="text-blue-600 hover:underline">
              Check for more
            </button>
          )}
          <button onClick={() => router.push('/')} className="text-blue-600 hover:underline">
            Back to the dashboard
          </button>
        </div>
      </Centered>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-2">
      <div>
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-700 dark:text-gray-200">
            {index + 1} / {items.length}
            <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
              {remaining - 1} after this
              {skipped > 0 && ` · ${skipped} skipped`}
            </span>
          </span>
          <button onClick={recheck} disabled={busy}
                  className="text-gray-500 hover:underline disabled:opacity-50">
            Re-check matches
          </button>
        </div>

        <ChargeCard item={current} onPick={link} busy={busy} />

        <div className="my-4 grid grid-cols-3 gap-2">
          <button onClick={alreadyIn} disabled={busy} className={ACTION}>
            Already in
          </button>
          <button onClick={skip} disabled={busy} className={ACTION}>
            Skip
          </button>
          <button onClick={back} disabled={busy || skipped === 0} className={ACTION}
                  title="Bring back the last charge you skipped">
            ← Back to skipped
          </button>
        </div>

        {notice && (
          <p className="mb-3 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm
                        text-gray-700 dark:text-gray-200">
            {notice}
          </p>
        )}
        {error && (
          <p className="mb-3 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

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
          submitLabel="Add as new & next"
          onSubmit={confirm}
          onSaved={() => advance('Added.', true)}
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          Your transactions that month
        </h2>
        <TransactionFinder
          month={current.date?.slice(0, 7)}
          amount={current.amount}
          onPick={link}
          pickLabel="It's this one"
        />
      </div>
    </div>
  );
}

const ACTION =
  'rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-semibold ' +
  'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 ' +
  'disabled:opacity-40';

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">{children}</div>
  );
}

/** What the bank or card actually reported, kept visible while deciding. */
function ChargeCard({
  item,
  onPick,
  busy,
}: {
  item: QueueItem;
  onPick: (txn: FoundTransaction) => void;
  busy: boolean;
}) {
  const confidence = item.category_confidence ?? 0;
  // Older imports lost the merchant column; the raw line still has it.
  const description =
    item.merchant_raw || item.merchant_clean || item.raw_cells.join(' · ');

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700
                    bg-gray-50 dark:bg-gray-800 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {formatDate(item.date)}
            {item.posted_date && item.posted_date !== item.date &&
              ` · charged ${formatDate(item.posted_date)}`}
          </p>
          <p dir="auto" className="mt-1 text-lg font-semibold text-gray-800 dark:text-gray-100">
            {description || 'No description on the statement'}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            from {item.source}
            {item.installment_total
              ? ` · instalment ${item.installment_no}/${item.installment_total}`
              : ''}
            {item.memo && <span dir="auto"> · {item.memo}</span>}
          </p>
        </div>
        <p className="whitespace-nowrap text-2xl font-bold text-gray-800 dark:text-gray-100">
          {item.amount} {item.currency}
        </p>
      </div>

      {item.candidates.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
            {item.state === 'ambiguous'
              ? 'More than one transaction could be this charge. Which is it?'
              : 'Possibly already in as:'}
          </p>
          <ul className="space-y-1">
            {item.candidates.map(c => (
              <li key={c.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-white
                             dark:bg-gray-700 px-3 py-1.5 text-sm">
                <span className="text-gray-800 dark:text-gray-100">
                  <span className="text-gray-500 dark:text-gray-400">{formatDate(c.date)}</span>
                  {' · '}
                  <span dir="auto">{c.description || c.category}</span>
                  {' · '}
                  {c.amount}
                </span>
                <button onClick={() => onPick(c)} disabled={busy}
                        className="whitespace-nowrap rounded-md bg-blue-600 px-2 py-0.5 text-xs
                                   font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  It&apos;s this one
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.state === 'proposed' && confidence === 0 && !item.candidates.length && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          No category guess for this merchant yet — pick one and it will be
          remembered next time.
        </p>
      )}
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
