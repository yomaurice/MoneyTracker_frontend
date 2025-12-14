'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { API_BASE_URL } from "@/utils/api_base";


export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();


  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setMsg("Updating password...");

    const res = await fetch(`${API_BASE_URL}/api/reset_password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();
    setMsg(data.message);

    if (res.ok) {
      setTimeout(() => router.push('/login'), 2000);
    }

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
            className="w-full bg-blue-600 text-white p-2 rounded disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Saving..." : "Set New Password"}
          </button>
        </form>

        <button
          onClick={() => router.push('/login')}
          className="mt-4 w-full bg-gray-300 text-black p-2 rounded"
        >
          Back to Login
        </button>

        {msg && <p className="mt-3 text-center text-gray-700">{msg}</p>}
      </div>
    </div>
  );
}
