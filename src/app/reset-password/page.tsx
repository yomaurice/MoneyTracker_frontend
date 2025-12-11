'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const API = process.env.NEXT_PUBLIC_BACKEND_URL;

  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setMsg("Updating password...");

    const res = await fetch(`${API}/api/reset_password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();
    setMsg(data.message);
    setLoading(false);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-6 rounded-xl shadow w-full max-w-md">
          <h1 className="text-xl font-bold mb-4">Reset Password</h1>
          <p className="text-red-600">Invalid or missing token.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl shadow w-full max-w-md">
        <h1 className="text-xl font-bold mb-4">Choose a New Password</h1>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full border p-2 rounded"
            placeholder="New password"
          />

          <button
            className="w-full bg-blue-600 text-white p-2 rounded"
            disabled={loading}
          >
            {loading ? "Saving..." : "Set New Password"}
          </button>
        </form>

        {msg && <p className="mt-3 text-center text-gray-700">{msg}</p>}
      </div>
    </div>
  );
}
