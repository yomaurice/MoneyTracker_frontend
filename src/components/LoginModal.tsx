'use client';

import { useRef, useState } from 'react';

import { API_BASE_URL } from '@/utils/api_base';
import { waitForBackend } from '@/utils/backendStatus';
import { markSessionFresh } from '@/utils/session';

/**
 * The login form, without the navigation.
 *
 * Extracted so a page can authenticate *in place*. That matters most on the
 * wallet deep link: its payload lives in the URL fragment, and any redirect to
 * /login discards it along with whatever the user had already edited. A modal
 * keeps the page, the fragment and the form state exactly where they are.
 *
 * `onSuccess` resolves instead of routing, so the caller decides what happens
 * next -- usually "retry the save that just failed".
 */
export default function LoginModal({
  onSuccess,
  onCancel,
  reason,
}: {
  onSuccess: () => void;
  onCancel?: () => void;
  reason?: string;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [warmingUp, setWarmingUp] = useState(false);
  const [busy, setBusy] = useState(false);

  const inProgress = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inProgress.current) return;
    inProgress.current = true;
    setBusy(true);
    setErrorMsg('');

    try {
      setWarmingUp(true);
      const ready = await waitForBackend(60000, 2000);
      setWarmingUp(false);
      if (!ready) {
        setErrorMsg('Server is taking longer than expected to wake up.');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        markSessionFresh();
        onSuccess();
        return;
      }

      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.message || 'Invalid credentials');
    } catch {
      setErrorMsg('Network error');
    } finally {
      inProgress.current = false;
      setBusy(false);
      setWarmingUp(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
        <h2 className="mb-2 text-xl font-bold text-blue-700 dark:text-blue-300">
          Sign in to save
        </h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          {reason || 'Your session expired. Nothing you entered has been lost.'}
        </p>

        {warmingUp && (
          <div className="mb-4 rounded-xl bg-blue-50 p-3 text-center text-sm text-blue-700">
            Waking the server…
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            autoFocus
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-700 px-3 py-2
                       text-gray-800 dark:text-gray-100"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-700 px-3 py-2
                       text-gray-800 dark:text-gray-100"
            required
          />

          {errorMsg && (
            <div className="rounded-lg bg-red-100 p-2 text-center text-sm text-red-800">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`w-full rounded-xl py-2.5 font-semibold text-white ${
              busy ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full text-sm text-gray-500 hover:underline"
            >
              Not now
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
