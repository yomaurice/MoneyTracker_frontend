'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from "@/utils/api_base";


export default function ForgotPassword() {
  const [username, setUsername] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setMsg("Checking user...");

    const res = await fetch(`${API_BASE_URL}/api/request_password_reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    const data = await res.json();

    // Backend now returns:
    // - 404 if user not found
    // - 200 if exists and email sent
    if (res.status === 404) {
      setMsg("User does not exist.");
      setLoading(false);
      return;
    }

    // User exists → email sent → redirect user
    setMsg("Reset email sent. Redirecting to login...");
    setTimeout(() => router.push('/login'), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl shadow w-full max-w-md">
        <h1 className="text-xl font-bold mb-4">Forgot Password</h1>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            className="w-full border p-2 rounded"
            placeholder="Enter your username"
          />

          <button
            className="w-full bg-blue-600 text-white p-2 rounded disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Please wait..." : "Send Reset Link"}
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
