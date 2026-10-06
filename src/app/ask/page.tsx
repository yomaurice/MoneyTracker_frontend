'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

import LoginModal from '@/components/LoginModal';
import { authFetch } from '@/utils/auth_fetch';
import { getApiBaseUrl } from '@/utils/api_base';

type Message = { role: 'user' | 'assistant'; text: string };

const EXAMPLES = [
  'How much did I spend on my car this year?',
  'What are my biggest expense categories in the last 3 months?',
  'How did my electricity bills change after December compared to a year earlier?',
];

export default function AskPage() {
  // Kept in the page only. The backend stores nothing about a chat, so a
  // reload starts fresh.
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const pending = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;

    const history = messages;
    setMessages([...history, { role: 'user', text: q }]);
    setInput('');
    setBusy(true);
    setError('');

    try {
      const res = await authFetch(`${getApiBaseUrl()}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history }),
      });

      if (res.status === 401) {
        // Retried once the user signs in again, rather than lost.
        pending.current = q;
        setMessages(history);
        setNeedsLogin(true);
        return;
      }

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages(history);
        setInput(q);
        setError(body.message || 'The assistant could not answer.');
        return;
      }

      setMessages([...history, { role: 'user', text: q },
                   { role: 'assistant', text: body.answer }]);
    } catch {
      setMessages(history);
      setInput(q);
      setError('Could not reach the server. It may still be waking up.');
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  if (needsLogin) {
    return (
      <LoginModal
        reason="Your session expired. Sign in to keep asking."
        onSuccess={() => {
          setNeedsLogin(false);
          const q = pending.current;
          pending.current = null;
          if (q) ask(q);
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-4">
      <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
        Ask about your money
      </h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
        Answers come from your own transactions. Check the breakdown it gives
        before relying on a number.
      </p>

      {messages.length === 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => ask(ex)}
              className="rounded-lg border border-gray-200 dark:border-gray-600
                         px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200
                         hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {messages.map((m, i) => (
          <div
            key={i}
            dir="auto"
            className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2 text-sm ${
              m.role === 'user'
                ? 'self-end bg-blue-600 text-white'
                : 'self-start bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
            }`}
          >
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="self-start rounded-xl bg-gray-100 px-4 py-2 text-sm
                          text-gray-500 dark:bg-gray-700 dark:text-gray-300">
            Looking through your transactions…
          </div>
        )}
        <div ref={bottom} />
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-6 flex gap-2">
        <input
          dir="auto"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          maxLength={2000}
          disabled={busy}
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600
                     bg-white dark:bg-gray-700 px-3 py-2
                     text-gray-800 dark:text-gray-100"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white
                     disabled:opacity-50"
        >
          Ask
        </button>
      </form>

      {messages.length > 0 && (
        <button
          onClick={() => {
            setMessages([]);
            setError('');
          }}
          className="mt-3 self-start text-xs text-gray-500 hover:underline"
        >
          Start over
        </button>
      )}
    </div>
  );
}
