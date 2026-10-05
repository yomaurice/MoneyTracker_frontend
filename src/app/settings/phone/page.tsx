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

// The phone talks to the backend directly rather than through this site's
// /api proxy (next.config.js), so a backend waking from sleep -- up to a
// minute -- cannot time the request out at the proxy.
const DIRECT_API = 'https://moneytrackerfl.onrender.com';

/**
 * Setting up wallet capture in MacroDroid, written against its own field
 * names (checked with the MacroDroid wiki, September 2026). Every value the
 * user has to type has a copy button.
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

  const link = `${origin}/add?title={not_title}&text={notification}&ts={not_timestamp}`;
  const sample =
    `/add?title=${encodeURIComponent('Test shop')}` +
    `&text=${encodeURIComponent('₪12.34 with Visa •••• 1234')}&ts=${Date.now()}`;
  const active = tokens.filter(t => t.active);

  return (
    <div className="mx-auto max-w-3xl px-4 text-gray-800 dark:text-gray-100">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
        <Smartphone aria-hidden /> Phone capture
      </h1>
      <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
        After this setup, every Google Wallet payment does two things on its own:
      </p>
      <ul className="mb-6 list-disc pl-6 text-sm text-gray-600 dark:text-gray-300">
        <li>sends the charge to your <b>Review</b> queue, so it is never forgotten;</li>
        <li>shows an <b>Add to MoneyTracker</b> notification — tap it and the
          expense opens already filled in, ready to save.</li>
      </ul>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
        It takes about ten minutes, on the phone. Open this page on the phone
        too, so the copy buttons put each value straight into MacroDroid.
      </p>

      {/* ------------------------------------------------------------- */}
      <Step n={1} title="Create a token">
        <p className="mb-2 text-sm">
          The phone sends this with every payment. It can only add charges to
          your Review queue — it cannot read or change your transactions.
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
            <p className="mb-1 font-semibold">
              Copy this now and keep it for step 4 — it is shown only once.
            </p>
            <Copyable value={`Bearer ${fresh}`} />
            <p className="mt-1 text-xs">
              (It already starts with “Bearer ” — paste it exactly as is.)
            </p>
          </div>
        )}
        {active.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {active.map(t => (
              <li key={t.id} className="flex items-center justify-between rounded-md
                                         bg-gray-50 px-3 py-1.5 dark:bg-gray-700">
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
        <p className="mt-2 text-xs text-gray-500">
          Lost it? Create a new one and revoke the old one with the bin icon.
        </p>
      </Step>

      {/* ------------------------------------------------------------- */}
      <Step n={2} title="Prepare the phone">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Install <b>MacroDroid</b> from the Play Store. The free version is
            enough (it allows 5 macros; this uses 1).</li>
          <li>In <b>Chrome</b>, sign in to MoneyTracker. The button opens Chrome,
            so this is the session it will use. If another browser is your
            default, switch the default to Chrome
            (Android Settings → Apps → Default apps → Browser app).</li>
          <li>Android Settings → Apps → MacroDroid → <b>Battery</b> → choose{' '}
            <b>Unrestricted</b>. Otherwise Android may stop it in the background
            and payments are missed.</li>
        </ol>
        <p className="mt-2 text-xs text-gray-500">
          MacroDroid will also ask for <b>Notification access</b> and{' '}
          <b>Display over other apps</b> while you build the macro. Allow both —
          the first lets it see the Wallet notification, the second lets it open
          Chrome from the background.
        </p>
      </Step>

      {/* ------------------------------------------------------------- */}
      <Step n={3} title="Create the macro and its trigger">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Open MacroDroid → <b>Add Macro</b>. Name it <b>MoneyTracker</b>.</li>
          <li>In the red <b>Triggers</b> box tap <b>+</b> → <b>Notifications</b> →{' '}
            <b>Notification</b>.</li>
          <li>Choose <b>Notification Received</b>.</li>
          <li><b>Select Applications</b> → <b>Include</b> → tick{' '}
            <b>Google Wallet</b> → OK.</li>
          <li>Text: <b>Any text</b>.</li>
          <li>Tick <b>Ignore ongoing/persistent notifications</b>, so Wallet’s
            permanent “ready to pay” notification does not trigger it. Leave{' '}
            <b>Prevent multiple triggers</b> ticked. OK.</li>
        </ol>
      </Step>

      {/* ------------------------------------------------------------- */}
      <Step n={4} title="Add four actions, in this order">
        <p className="mb-3 text-sm">
          In the blue <b>Actions</b> box tap <b>+</b> for each one. The easiest
          way to find an action is the <b>search box</b> at the top of the list —
          type its name. Text in <code>{'{curly brackets}'}</code> is MacroDroid
          magic text: paste it as is and MacroDroid fills in the payment’s
          details each time.
        </p>

        <Action n="4a" name="Set Variable" why="builds the link the notification opens">
          <Row label="Select Variable">
            <b>[New Variable]</b> → name <Copyable value="mt_link" inline /> →{' '}
            <b>Global</b> → type <b>String</b>
          </Row>
          <Row label="Value"><Copyable value={link} /></Row>
        </Action>

        <Action n="4b" name="HTTP Request" why="wakes the server up while you look at your phone">
          <Row label="Request method"><b>GET</b></Row>
          <Row label="URL"><Copyable value={`${DIRECT_API}/api/health`} /></Row>
          <Row label="Everything else">leave as is</Row>
        </Action>

        <Action n="4c" name="HTTP Request" why="sends the charge to your Review queue">
          <Row label="Request method"><b>POST</b></Row>
          <Row label="URL"><Copyable value={`${DIRECT_API}/api/ingest/wallet`} /></Row>
          <Row label="Timeout (s)">
            <Copyable value="90" inline /> — the server can take up to a minute to wake
          </Row>
          <Row label="Query Params">add three rows (key → value):</Row>
          <Row label="">
            <div className="space-y-1">
              <div><Copyable value="title" inline /> → <Copyable value="{not_title}" inline /></div>
              <div><Copyable value="text" inline /> → <Copyable value="{notification}" inline /></div>
              <div><Copyable value="ts" inline /> → <Copyable value="{not_timestamp}" inline /></div>
            </div>
          </Row>
          <Row label="Header Params">one row:</Row>
          <Row label="">
            <Copyable value="Authorization" inline /> → the <b>Bearer …</b> value
            from step 1
          </Row>
          <Row label="Content Body">leave empty</Row>
        </Action>

        <Action n="4d" name="Display Notification" why="the button you tap">
          <Row label="Title"><Copyable value="Add to MoneyTracker" /></Row>
          <Row label="Text"><Copyable value="{not_title} · {notification}" /></Row>
          <Row label="Clear existing notifications">tick it</Row>
          <Row label="Invoke action, action block or macro on click">
            choose <b>Action</b> → search <b>Open Website</b> →{' '}
            <b>Enter url</b>: <Copyable value="{v=mt_link}" inline /> → keep{' '}
            <b>URL encode parameters</b> ticked → OK
          </Row>
        </Action>

        <p className="mt-3 text-sm">
          Save the macro with the <b>✓</b> at the top, and check its switch is on.
        </p>
      </Step>

      {/* ------------------------------------------------------------- */}
      <Step n={5} title="Test it">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>
            See what the button will open:{' '}
            <a href={sample} className="text-blue-600 hover:underline">sample expense</a>.
          </li>
          <li>Pay for something small with Google Wallet. Within a few seconds
            you should see <b>Add to MoneyTracker</b>; tap it.</li>
          <li>Back on this page, the token in step 1 should say “last used”, and
            the charge should be under <b>Review</b>.</li>
        </ol>
      </Step>

      {/* ------------------------------------------------------------- */}
      <Step n={6} title="If something doesn’t work">
        <ul className="space-y-2 text-sm">
          <li><b>Nothing happens after paying.</b> MacroDroid needs Notification
            access, Google Wallet must be ticked in the trigger, and MacroDroid’s
            battery setting must be Unrestricted. MacroDroid’s <b>System Log</b>{' '}
            (in its menu) shows whether the macro ran.</li>
          <li><b>The token still says “never used”.</b> Check action 4c: method
            POST, the URL exactly as above, and the header key{' '}
            <code>Authorization</code> with a value starting <code>Bearer </code>.</li>
          <li><b>Tapping asks me to sign in every time.</b> It opened a browser
            other than the one you signed in with — make Chrome the default.</li>
          <li><b>The page opens but nothing is filled in.</b> In action 4d, the
            url must be exactly <code>{'{v=mt_link}'}</code>, and action 4a must
            come first.</li>
          <li><b>The amount or shop is wrong.</b> Send the notification text to
            whoever maintains the app — the reader learns new wording from
            examples. The charge is still in Review with the text shown.</li>
        </ul>
      </Step>

      {/* ------------------------------------------------------------- */}
      <Step n={7} title="Optional: keep the server awake">
        <p className="text-sm">
          The free server sleeps after 15 idle minutes and takes up to a minute
          to wake, which makes the first save of the day slow. At{' '}
          <b>cron-job.org</b> (free), add a job that calls this URL every 10
          minutes between 07:00 and 24:00 — not around the clock, which would use
          up the free hosting hours.
        </p>
        <div className="mt-1"><Copyable value={`${DIRECT_API}/api/health`} /></div>
      </Step>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-lg border border-gray-200 bg-white p-4
                        dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                         bg-blue-600 text-xs text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Action({ n, name, why, children }: {
  n: string; name: string; why: string; children: React.ReactNode;
}) {
  return (
    <div className="mb-3 rounded-md border border-gray-200 p-3 dark:border-gray-600">
      <p className="mb-2 text-sm">
        <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold
                         dark:bg-gray-700">{n}</span>
        <b>{name}</b> <span className="text-gray-500">— {why}</span>
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 text-sm sm:grid-cols-[11rem_1fr] sm:gap-2">
      <span className="text-gray-500">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function Copyable({ value, inline }: { value: string; inline?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className={`${inline ? 'inline-flex' : 'flex'} items-start gap-1.5 align-middle`}>
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
        aria-label={`Copy ${value}`}
        className="shrink-0 pt-0.5 text-gray-500 hover:text-gray-800"
      >
        {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
      </button>
    </span>
  );
}
