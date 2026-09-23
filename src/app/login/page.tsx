'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { waitForBackend } from '../../utils/backendStatus';
import { API_BASE_URL } from "@/utils/api_base";
import { markSessionFresh } from "@/utils/session";



/**
 * Where to go after signing in.
 *
 * Same-origin relative paths only. Without that check, `?returnTo=` would be
 * an open redirect: a link to our own login page could bounce the user to
 * someone else's site immediately after they typed their password, which is
 * exactly the shape a credible phishing flow wants. `//evil.com` is rejected
 * too -- browsers read a protocol-relative path as an absolute URL.
 */
function safeReturnTo(candidate: string | null): string {
  if (!candidate) return '/';
  if (!candidate.startsWith('/')) return '/';
  if (candidate.startsWith('//')) return '/';
  return candidate;
}

/**
 * Read `returnTo` straight off the URL rather than through useSearchParams,
 * which would opt this whole route out of static prerendering. The page is
 * already client-only, so there is nothing to gain from the hook.
 */
function returnToFromUrl(): string {
  if (typeof window === 'undefined') return '/';
  return safeReturnTo(
    new URLSearchParams(window.location.search).get('returnTo'),
  );
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [warmingUp, setWarmingUp] = useState(false);

  const router = useRouter();
  const loginInProgress = useRef(false);
  const backendReady = useRef(false);

  useEffect(() => {
    waitForBackend(60000, 2000).then((ready) => {
      backendReady.current = ready;
    });
  }, []);

 const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();

  if (loginInProgress.current) return;
  loginInProgress.current = true;

  setErrorMsg('');

  if (!backendReady.current) {
    setWarmingUp(true);
    const ready = await waitForBackend(60000, 2000);
    setWarmingUp(false);
    if (!ready) {
      loginInProgress.current = false;
      setErrorMsg('Server is taking longer than expected to wake up.');
      return;
    }
    backendReady.current = true;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      sessionStorage.setItem('authSettling', 'true');
      markSessionFresh();
      router.push(returnToFromUrl());
      return;
    }

    const data = await res.json();
    setErrorMsg(data.message || 'Invalid credentials');
  } catch {
    setErrorMsg('Network error');
  } finally {
    loginInProgress.current = false; // 🔓 unlock
    setWarmingUp(false);
  }
};


 return (
  <div className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-300 flex items-center justify-center px-4">
    <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
      <h1 className="text-3xl font-bold text-center text-blue-700 mb-6">
        Welcome Back
      </h1>

      {/* ✅ BACKEND WAKING MESSAGE (added) */}
      {warmingUp && (
        <div className="mb-4 p-3 rounded-xl bg-blue-50 text-blue-700 text-sm text-center">
          🔄 Server is waking up… first login may take ~15 seconds. Your login will continue automatically.
        </div>
      )}

      {/* ✅ ERROR MESSAGE */}
      {errorMsg && (
        <p className="mb-3 text-red-500 text-sm text-center">
          {errorMsg}
        </p>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-gray-700">Username</label>
          <input
            type="text"
            className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-gray-700">Password</label>
          <input
            type="password"
            className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 transition-colors"
        >
          Log In
        </button>
      </form>

      <p className="mt-4 text-sm text-center text-gray-600">
        Don&apos;t have an account?{" "}
        <a href="/signup" className="text-blue-600 hover:underline">
          Sign up here
        </a>
      </p>

      {/* ✅ NEW: Forgot password link */}
      <p className="mt-2 text-sm text-center text-gray-600">
        Forgot your password?{" "}
        <a href="/forgot-password" className="text-blue-600 hover:underline">
          Reset it here
        </a>
      </p>
    </div>
  </div>
);

}

