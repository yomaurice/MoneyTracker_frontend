'use client';

import { useState } from "react";

export default function ForgotPassword() {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch(`${API_BASE_URL}/api/request_password_reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    const data = await res.json();
    setMessage(data.message);
    if (data.reset_token) {
      setToken(data.reset_token); // show token to user for manual use
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-6 rounded shadow max-w-md w-full">
        <h1 className="text-xl font-bold mb-4">Reset Your Password</h1>

        <form onSubmit={requestReset} className="space-y-3">
          <input
            type="text"
            placeholder="Enter your username"
            className="w-full p-2 border rounded"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />

          <button className="w-full bg-blue-600 text-white p-2 rounded">
            Get Reset Token
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}

        {token && (
          <div className="mt-3 p-3 bg-gray-100 border rounded break-all">
            <p className="text-sm font-semibold">Reset Token:</p>
            <p className="text-xs">{token}</p>
            <p className="text-xs mt-2">
              Paste this token into the reset form.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
