'use client';
import { useState } from 'react';

export default function ForgotPassword() {
  const [username, setUsername] = useState('');
  const [msg, setMsg] = useState('');

  const API = process.env.NEXT_PUBLIC_BACKEND_URL;

  const submit = async (e: any) => {
    e.preventDefault();
    setMsg("Sending...");

    const res = await fetch(`${API}/api/request_password_reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    const data = await res.json();
    setMsg(data.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl shadow w-full max-w-md">
        <h1 className="text-xl font-bold mb-4">Reset Password</h1>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            className="w-full border p-2 rounded"
            placeholder="Your username"
          />

          <button className="w-full bg-blue-600 text-white p-2 rounded">
            Send Reset Link
          </button>
        </form>

        {msg && <p className="mt-3 text-center text-gray-700">{msg}</p>}
      </div>
    </div>
  );
}
