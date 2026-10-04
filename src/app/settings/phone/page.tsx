'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Smartphone, Trash2 } from 'lucide-react';

import LoginModal from '@/components/LoginModal';
import { authFetch } from '@/utils/auth_fetch';
import { getApiBaseUrl } from '@/utils/api_base';

type Token = {
  id: number;
  name: string;
  prefix: string;
  created_at: string | null;
  last_used_at: string | null;
  active: boolean;
};

/**
 * Setting up wallet capture: mint the token the phone sends with, and the
 * exact values to paste into the automation app.
 */
export default function PhoneSetupPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [name, setName] = useState('My phone');
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [origin, setOrigin] = useState('');

  const load = useCallback(async () => {
    const res = await authFetch(`${getApiBaseUrl()}/api/tokens`);
    if (res.status === 401) return setNeedsLogin(true);
    if (res.ok) setTokens(await res.json());
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, [load]);

  const create = async () => {
    setError('');
    const res = await authFetch(`${getApiBaseUrl()}/api/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) return setNeedsLogin(true);
    if (!res.ok) return setError(body.message || 'Could not create a token.');
    setFresh(body.token);
    load();
  };

  const revoke = async (id: number) => {
    if (!window.confirm('Revoke this token? A phone using it stops sending.')) return;
    await authFetch(`${getApiBaseUrl()}/api/tokens/${id}`, { method: 'DELETE' });
    load();
  };

  if (needsLogin) {
    return (
      <LoginModal
        reason="Sign in to set up phone capture."
        onSuccess={() => { setNeedsLogin(false); load(); }}
      />
    );
  }

  const health = `${origin}/api/health`;
  const ingest = `${origin}/api/ingest/wallet`;
  const deepLink =
    `${origin}/add#title={notification title}&text={notification text}&ts={time}`;
  const body = '{"title": "{notification title}", "text": "{notification text}", "ts": "{time}"}';
  const sample =
    `/add#title=${encodeURIComponent('Test shop')}` +
    `&text=${encodeURIComponent('₪12.34 with Visa •••• 1234')}&ts=${Date.now()}`;
  const active = tokens.filter(t => t.active);

  return (
    <div className="mx-auto max-w-3xl px-4 text-gray-800 dark:text-gray-100">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
        <Smartphone aria-hidden /> Phone capture
      </h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
        When you pay with Google Wallet, your phone shows a notification with an
        “Add to MoneyTracker” button that opens this app with the expense filled
        in. The charge also goes to the review queue in the background, so it is
        never lost if you swipe the notification away.
      </p>

      <Step n={1} title="Create a token for your phone">
        <p className="mb-2 text-sm">
          The token lets the phone add charges to your review queue — nothing
          else. It cannot read or change your transactions.
        </p>
        <div className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)}
                 className="rounded-md border px-2 py-1 text-sm dark:bg-gray-700"
                 aria-label="Token name" />
          <button onClick={create}
                  className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-sm
                             font-semibold text-white hover:bg-blue-700">
            <KeyRound size={16} aria-hidden /> Create token
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {fresh && (
          <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            <p className="mb-1 font-semibold">Copy it now — it is shown only once.</p>
            <Copyable value={fresh} />
          </div>
        )}
        {active.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {active.map(t => (
              <li key={t.id} className="flex items-center justify-between rounded-md
                                         bg-gray-50 px-3 py-1.5 dark:bg-gray-800">
                <span>
                  {t.name} <span className="text-gray-500">({t.prefix}…)</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {t.last_used_at
                      ? `last used ${t.last_used_at.slice(0, 16).replace('T', ' ')}`
                      : 'never used'}
                  </span>
                </span>
                <button onClick={() => revoke(t.id)} aria-label="Revoke"
                        className="text-red-600 hover:text-red-800">
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Step>

      <Step n={2} title="Install MacroDroid and create a macro">
        <p className="text-sm">
          Install <b>MacroDroid</b> from the Play Store (the free version is
          enough for one macro). Add a macro with this <b>trigger</b>:
          Notification → <i>Notification received</i> → app <b>Google Wallet</b>.
          Allow MacroDroid notification access when it asks.
        </p>
      </Step>

      <Step n={3} title="Add three actions, in this order">
        <p className="mb-2 text-sm">
          Wherever you see <code>{'{notification title}'}</code>,{' '}
          <code>{'{notification text}'}</code> or <code>{'{time}'}</code>, insert
          MacroDroid’s matching <i>magic text</i> with its “…” button: the
          notification’s title, its text, and the current time (any format — the
          app reads epoch seconds, milliseconds or a date). Use the{' '}
          <b>same time value</b> in actions b and c; it is what stops the two
          paths saving the expense twice.
        </p>

        <p className="mt-3 text-sm font-semibold">a. HTTP request — wake the server</p>
        <Field label="Method" value="GET" />
        <Field label="URL" value={health} copy />

        <p className="mt-3 text-sm font-semibold">b. HTTP request — send to the review queue</p>
        <Field label="Method" value="POST" />
        <Field label="URL" value={ingest} copy />
        <Field label="Header" value="Authorization: Bearer <your token from step 1>" />
        <Field label="Content type" value="application/json" />
        <Field label="Body" value={body} copy />

        <p className="mt-3 text-sm font-semibold">c. Display notification — the button</p>
        <Field label="Title" value="Add to MoneyTracker" />
        <Field label="Text" value="{notification text}" />
        <Field label="On press: open website" value={deepLink} copy />
        <p className="mt-1 text-xs text-gray-500">
          Make it open in <b>Chrome</b> (the browser you are signed in with), not
          MacroDroid’s built-in viewer — that one has no session and would ask
          you to sign in every time.
        </p>
      </Step>

      <Step n={4} title="Try it">
        <p className="text-sm">
          Open the add page with a made-up payment to see what the button leads
          to: <a href={sample} className="text-blue-600 hover:underline">sample expense</a>.
          Then pay for something small with Google Wallet; the charge should
          appear under <b>Review</b> within a minute, and the token above will
          show “last used”.
        </p>
      </Step>

      <Step n={5} title="Optional: keep the server awake">
        <p className="text-sm">
          The free server sleeps after 15 idle minutes and takes up to a minute
          to wake. At <b>cron-job.org</b> (free), add a job calling the URL below
          every 10 minutes between 07:00 and 24:00. Not around the clock: that
          would use up the free hosting hours.
        </p>
        <Field label="URL" value={health} copy />
      </Step>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-lg border border-gray-200 bg-white p-4
                        dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-2 flex items-center gap-2 font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600
                         text-xs text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="mt-1 grid grid-cols-[8rem_1fr] items-start gap-2 text-sm">
      <span className="text-gray-500">{label}</span>
      {copy ? <Copyable value={value} /> : <code className="break-all">{value}</code>}
    </div>
  );
}

function Copyable({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex items-start gap-2">
      <code className="break-all rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-700">{value}</code>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked; the text is selectable */
          }
        }}
        aria-label="Copy"
        className="shrink-0 text-gray-500 hover:text-gray-800"
      >
        {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      </button>
    </span>
  );
}
