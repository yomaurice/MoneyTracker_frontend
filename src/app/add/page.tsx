'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CloudOff, Sparkles } from 'lucide-react';

import AddTransaction, {
  TransactionInitialValues,
  TransactionPayload,
} from '@/components/AddTransaction';
import LoginModal from '@/components/LoginModal';
import { authFetch } from '@/utils/auth_fetch';
import { getApiBaseUrl } from '@/utils/api_base';
import { parseNotification } from '@/utils/walletParse';
import { queueDraft, saveWallet, WalletDraft } from '@/utils/walletDrafts';

type Note = { title: string; text: string; ts: string };

/**
 * Where a payment notification lands: /add#title=…&text=…&ts=….
 *
 * Everything needed is in the URL fragment, which browsers never send to a
 * server, so the form is filled the instant the page loads -- no backend
 * round-trip, asleep or not. Only saving needs the backend, and a save that
 * cannot get through is kept on the phone and retried when the app opens.
 *
 * Never redirects: an expired session is answered with a sign-in box on this
 * page, so the payment and any edits survive it.
 */
export default function AddFromNotification() {
  const [note, setNote] = useState<Note | null>(null);
  const [ready, setReady] = useState(false);
  const [initialValues, setInitialValues] = useState<TransactionInitialValues>();
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [pending, setPending] = useState<WalletDraft | null>(null);
  const [matched, setMatched] = useState<any>(null);
  const [done, setDone] = useState<'saved' | 'already' | 'queued' | 'skipped' | null>(null);

  useEffect(() => {
    const found = readFragment(window.location.hash);
    if (found) {
      setNote(found);
      const parsed = parseNotification(found.title, found.text);
      setInitialValues({
        type: parsed.type,
        amount: parsed.amount ?? undefined,
        currency: parsed.currency ?? undefined,
        description: parsed.merchant ?? '',
        date: dateFromTs(found.ts),
      });

      // A category guess needs the server; ask quietly, and offer it rather
      // than writing it into a form the user may already be editing.
      if (parsed.merchant) {
        const q = new URLSearchParams({ merchant: parsed.merchant, type: parsed.type });
        authFetch(`${getApiBaseUrl()}/api/review/suggest?${q}`)
          .then(r => (r.ok ? r.json() : null))
          .then(body => body?.category && setSuggestion(body.category))
          .catch(() => {});
      }
    }
    setReady(true);
  }, []);

  const finish = useCallback((outcome: typeof done) => {
    setDone(outcome);
    // A reload must not show the same payment as unsaved.
    history.replaceState(null, '', window.location.pathname);
  }, []);

  const attempt = useCallback(async (body: WalletDraft) => {
    const outcome = await saveWallet(body);
    switch (outcome.kind) {
      case 'saved':
        finish('saved');
        return { ok: true, message: 'Saved' };
      case 'already':
        finish('already');
        return { ok: true, message: 'Already saved' };
      case 'matched':
        setPending(body);
        setMatched(outcome.matched || {});
        return { ok: false, message: 'This looks like something you already added.' };
      case 'login':
        setPending(body);
        setNeedsLogin(true);
        return { ok: false, message: 'Sign in to save — nothing is lost.' };
      case 'invalid':
        return { ok: false, message: outcome.message };
      case 'offline':
        queueDraft(body);
        finish('queued');
        return { ok: true, message: 'Kept on this phone' };
    }
  }, [finish]);

  const submit = useCallback(
    (payload: TransactionPayload) => attempt({ ...note, ...payload }),
    [note, attempt],
  );

  if (!ready) return null;

  // Opened without a notification: just the ordinary add form.
  if (!note) {
    return (
      <div className="mx-auto max-w-2xl px-4">
        <AddTransaction />
      </div>
    );
  }

  if (done) return <Done outcome={done} />;

  return (
    <div className="mx-auto max-w-2xl px-4">
      {needsLogin && (
        <LoginModal
          reason="Your session expired. Sign in and this expense will be saved."
          onSuccess={async () => {
            setNeedsLogin(false);
            if (pending) await attempt(pending);
          }}
          onCancel={() => setNeedsLogin(false)}
        />
      )}

      <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm
                      dark:border-gray-700 dark:bg-gray-800">
        <p className="text-xs uppercase tracking-wide text-gray-500">From your phone</p>
        <p dir="auto" className="font-semibold text-gray-800 dark:text-gray-100">{note.title}</p>
        <p dir="auto" className="text-gray-600 dark:text-gray-300">{note.text}</p>
      </div>

      {suggestion && (
        <button
          onClick={() => {
            setInitialValues({ category: suggestion });
            setSuggestion(null);
          }}
          className="mb-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm
                     text-blue-800 hover:bg-blue-100"
        >
          <Sparkles size={16} aria-hidden />
          Use category “{suggestion}”
        </button>
      )}

      {matched && (
        <div className="mb-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-900">
          <p className="font-semibold">You may have added this already</p>
          {matched.description && (
            <p dir="auto">
              {matched.date} · {matched.description} · {matched.amount}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => finish('skipped')}
              className="rounded-md bg-amber-600 px-3 py-1 font-semibold text-white"
            >
              It&apos;s the same — done
            </button>
            <button
              onClick={async () => {
                setMatched(null);
                if (pending) await attempt({ ...pending, force: true });
              }}
              className="rounded-md border border-amber-700 px-3 py-1 font-semibold"
            >
              Save anyway
            </button>
          </div>
        </div>
      )}

      <AddTransaction
        initialValues={initialValues}
        submitLabel="Save expense"
        onSubmit={submit}
      />
    </div>
  );
}

function Done({ outcome }: { outcome: 'saved' | 'already' | 'queued' | 'skipped' }) {
  const text = {
    saved: 'Saved.',
    already: 'This one was already saved.',
    skipped: 'Nothing added — it was already in.',
    queued:
      'Kept on this phone. The server could not be reached; it will be ' +
      'uploaded the next time you open the app.',
  }[outcome];
  const Icon = outcome === 'queued' ? CloudOff : CheckCircle2;

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <Icon size={48} className="mx-auto mb-4 text-green-600" aria-hidden />
      <p className="mb-6 text-lg text-gray-800 dark:text-gray-100">{text}</p>
      <a href="/" className="text-blue-600 hover:underline">Back to the dashboard</a>
    </div>
  );
}

/** title / text / ts from "#title=…&text=…&ts=…", tolerant of unencoded text. */
function readFragment(hash: string): Note | null {
  const body = hash.replace(/^#/, '');
  if (!body) return null;

  const fields: Record<string, string> = {};
  // Split on the known keys rather than on every '&', so an unencoded '&'
  // inside a shop's name does not cut the text short.
  const parts = body.split(/&(?=(?:title|text|ts)=)/);
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq);
    let value = part.slice(eq + 1).replace(/\+/g, ' ');
    try {
      value = decodeURIComponent(value);
    } catch {
      /* already plain text */
    }
    fields[key] = value;
  }

  if (!fields.title && !fields.text) return null;
  return { title: fields.title || '', text: fields.text || '', ts: fields.ts || '' };
}

/** YYYY-MM-DD in the phone's own time zone, from epoch s/ms or an ISO date. */
function dateFromTs(ts: string): string {
  const local = (d: Date) => d.toLocaleDateString('en-CA');
  if (/^\d+$/.test(ts)) {
    const n = Number(ts);
    return local(new Date(ts.length > 11 ? n : n * 1000));
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(ts)) return ts.slice(0, 10);
  return local(new Date());
}
