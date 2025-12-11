'use client';

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function ResetPassword() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tokenFromURL = searchParams.get("token") || "";

  const [token, setToken] = useState(tokenFromURL);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch(`${API_BASE_URL}/api/reset_password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: newPassword }),
    });

    const data = await res.json();
    setMessage(data.message);

    if (res.ok) {
      setTimeout(() => router.push("/login"), 1500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-6 rounded shadow max-w-md w-full">
        <h1 className="text-xl font-bold mb-4">Enter New Password</h1>

        <form onSubmit={submitReset} className="space-y-3">
          {!tokenFromURL && (
            <input
              type="text"
              className="w-full p-2 border rounded"
              placeholder="Reset token"
              value={token}
              onChange={e => setToken(e.target.value)}
            />
          )}

          <input
            type="password"
            className="w-full p-2 border rounded"
            placeholder="New password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />

          <button className="w-full bg-green-600 text-white p-2 rounded">
            Reset Password
          </button>
        </form>

        {message && (
          <p className="mt-3 text-sm text-gray-700 text-center">{message}</p>
        )}
      </div>
    </div>
  );
}
