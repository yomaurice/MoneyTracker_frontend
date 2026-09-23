'use client';

import { useCallback, useEffect, useState } from 'react';

import LoginModal from '@/components/LoginModal';
import { authFetch } from '@/utils/auth_fetch';
import { getApiBaseUrl } from '@/utils/api_base';

type Profile = {
  id: number;
  name: string;
  kind: string;
  company_id: string;
  account_last4: string | null;
  combine_installments: boolean;
  exclude_patterns: string[];
  active: boolean;
};

type Defaults = {
  kinds: string[];
  companies: string[];
  default_bank_exclude_patterns: string[];
};

const BLANK = {
  name: '',
  kind: 'card',
  company_id: 'max',
  account_last4: '',
};

export default function AccountsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, d] = await Promise.all([
        authFetch(`${getApiBaseUrl()}/api/source-profiles`),
        authFetch(`${getApiBaseUrl()}/api/source-profiles/defaults`),
      ]);
      if (p.status === 401 || d.status === 401) {
        setNeedsLogin(true);
        return;
      }
      if (p.ok) setProfiles(await p.json());
      if (d.ok) setDefaults(await d.json());
    } catch {
      setError('Could not reach the server.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBusy(true);
      setError('');
      try {
        const res = await authFetch(`${getApiBaseUrl()}/api/source-profiles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (res.status === 401) {
          setNeedsLogin(true);
          return;
        }
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.message || 'Could not add that account.');
          return;
        }
        setForm({ ...BLANK });
        load();
      } finally {
        setBusy(false);
      }
    },
    [form, load],
  );

  const remove = useCallback(
    async (profile: Profile) => {
      setError('');
      const res = await authFetch(
        `${getApiBaseUrl()}/api/source-profiles/${profile.id}`,
        { method: 'DELETE' },
      );
      if (res.status === 401) {
        setNeedsLogin(true);
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 409 means imported rows point at it, and their provenance is worth
        // more than a tidy list.
        setError(body.message || 'Could not remove that account.');
        return;
      }
      load();
    },
    [load],
  );

  const toggleActive = useCallback(
    async (profile: Profile) => {
      const res = await authFetch(
        `${getApiBaseUrl()}/api/source-profiles/${profile.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !profile.active }),
        },
      );
      if (res.status === 401) {
        setNeedsLogin(true);
        return;
      }
      load();
    },
    [load],
  );

  if (needsLogin) {
    return (
      <LoginModal
        reason="Your session expired. Sign in to manage your accounts."
        onSuccess={() => {
          setNeedsLogin(false);
          load();
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4">
      <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
        Banks and cards
      </h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
        Naming your accounts lets imports remember each statement&apos;s column
        layout, and lets a bank statement suppress its own monthly card charge
        so those purchases are not counted twice. No passwords are stored here —
        nothing on this page can access your bank.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <ul className="mb-8 space-y-2">
        {profiles.map(p => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-lg border
                       border-gray-200 dark:border-gray-700 px-3 py-2"
          >
            <div>
              <span
                className={`font-medium ${
                  p.active
                    ? 'text-gray-800 dark:text-gray-100'
                    : 'text-gray-400 line-through'
                }`}
              >
                {p.name}
              </span>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {p.kind} · {p.company_id}
                {p.account_last4 ? ` · ···${p.account_last4}` : ''}
                {p.exclude_patterns.length
                  ? ` · ${p.exclude_patterns.length} exclusion rules`
                  : ''}
              </div>
            </div>
            <div className="flex gap-3 text-xs">
              <button
                onClick={() => toggleActive(p)}
                className="text-gray-600 hover:underline dark:text-gray-300"
              >
                {p.active ? 'Deactivate' : 'Reactivate'}
              </button>
              <button
                onClick={() => remove(p)}
                className="text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {profiles.length === 0 && (
          <li className="text-sm text-gray-500 dark:text-gray-400">
            No accounts yet. Imports still work without one — naming them just
            makes each import smarter.
          </li>
        )}
      </ul>

      <form
        onSubmit={create}
        className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
      >
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          Add an account
        </h2>

        <input
          type="text"
          placeholder="Name, e.g. Max ···1234"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600
                     bg-white dark:bg-gray-700 px-3 py-2
                     text-gray-800 dark:text-gray-100"
        />

        <div className="flex gap-3">
          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-700 px-3 py-2
                       text-gray-800 dark:text-gray-100"
          >
            {(defaults?.kinds || ['bank', 'card']).map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>

          <select
            value={form.company_id}
            onChange={(e) => setForm({ ...form, company_id: e.target.value })}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-700 px-3 py-2
                       text-gray-800 dark:text-gray-100"
          >
            {(defaults?.companies || []).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <input
            type="text"
            inputMode="numeric"
            placeholder="Last 4"
            value={form.account_last4}
            onChange={(e) =>
              setForm({ ...form, account_last4: e.target.value })
            }
            className="w-24 rounded-lg border border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-700 px-3 py-2
                       text-gray-800 dark:text-gray-100"
          />
        </div>

        {form.kind === 'bank' && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            A bank account starts with rules that hide its monthly card
            settlement lines — one such line is the same money as all your card
            purchases that month.
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className={`w-full rounded-xl py-2.5 font-semibold text-white ${
            busy ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {busy ? 'Adding…' : 'Add account'}
        </button>
      </form>

      <p className="mt-8 text-sm">
        <a href="/sync" className="text-blue-600 hover:underline">
          ← Back to importing
        </a>
      </p>
    </div>
  );
}
