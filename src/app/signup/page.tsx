'use client';

import { useState, useEffect } from 'react';   // ✅ FIX: added useEffect
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from "../utils/api_base";


export default function Signup() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');


  const router = useRouter();

  // --------------------------------------------------------
  // ✅ Live username availability check
  // --------------------------------------------------------
  useEffect(() => {
    if (username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const controller = new AbortController();

    fetch(`${API_BASE_URL}/api/check_username?username=${username}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        setUsernameAvailable(data.available);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [username, API_BASE_URL]);

  // --------------------------------------------------------
  // ✅ Signup submit
  // --------------------------------------------------------
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch(`${API_BASE_URL}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email }),
    });

    if (res.ok) {
      router.push('/login');
    } else {
      const data = await res.json();
      setErrorMsg(data.message || 'Signup failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 to-green-300 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-green-700 mb-6">
          Create Account
        </h1>

        <form onSubmit={handleSignup} className="space-y-4">
          {/* Username */}
          <div>
            <label className="block text-gray-700">Username</label>
            <input
              type="text"
              className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            {/* Username availability indicator */}
            {username.length >= 3 && usernameAvailable === false && (
              <p className="text-xs text-red-500 mt-1">
                Username already taken
              </p>
            )}
            {username.length >= 3 && usernameAvailable === true && (
              <p className="text-xs text-green-600 mt-1">
                Username is available ✔️
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-gray-700">Password</label>
            <input
              type="password"
              className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div>
          <label className="block text-gray-700">Email</label>
              <input
                type="email"
                className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
        </div>


          {/* Error message (from backend only) */}
          {errorMsg && (
            <p className="text-red-500 text-sm text-center">{errorMsg}</p>
          )}

          <button
            type="submit"
            className="w-full bg-green-600 text-white py-2 rounded-xl hover:bg-green-700 transition-colors"
            disabled={usernameAvailable === false}   // 🚫 block submit when taken
          >
            Sign Up
          </button>
        </form>

        <p className="mt-4 text-sm text-center text-gray-600">
          Already have an account?{' '}
          <a href="/login" className="text-green-600 hover:underline">
            Log in here
          </a>
        </p>
      </div>
    </div>
  );
}
