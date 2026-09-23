'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import LoginModal from '@/components/LoginModal';
import { authFetch } from '@/utils/auth_fetch';
import { getApiBaseUrl } from '@/utils/api_base';

type Profile = {
  id: number;
  name: string;
  kind: string;
  company_id: string;
  active: boolean;
};

type Batch = {
  id: number;
  source: string;
  source_profile_name: string | null;
  window_start: string | null;
  window_end: string | null;
  received: number;
  new: number;
  matched: number;
  proposed: number;
  ambiguous: number;
  suppressed: number;
  status: string;
  created_at: string | null;
};

type UploadResult = {
  message: string;
  batch: Batch;
  duplicates_skipped: number;
  unreadable_rows: number;
};

export default function SyncPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState<string>('');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, b] = await Promise.all([
        authFetch(`${getApiBaseUrl()}/api/source-profiles`),
        authFetch(`${getApiBaseUrl()}/api/import-batches`),
      ]);
      if (p.status === 401 || b.status === 401) {
        setNeedsLogin(true);
        return;
      }
      if (p.ok) setProfiles(await p.json());
      if (b.ok) setBatches(await b.json());
    } catch {
      setError('Could not reach the server. It may still be waking up.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = useCallback(
    async (file: File) => {
      setBusy(true);
      setError('');
      setResult(null);

      const form = new FormData();
      form.append('file', file);
      if (profileId) form.append('source_profile_id', profileId);

      try {
        const res = await authFetch(`${getApiBaseUrl()}/api/import/upload`, {
          method: 'POST',
          body: form,
        });

        if (res.status === 401) {
          setNeedsLogin(true);
          return;
        }

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          // The parser's messages say what to do about the file, so they are
          // shown verbatim rather than replaced with something generic.
          setError(body.message || 'That file could not be imported.');
          return;
        }

        setResult(body);
        load();
      } catch {
        setError('Upload failed. Check your connection and try again.');
      } finally {
        setBusy(false);
        if (fileInput.current) fileInput.current.value = '';
      }
    },
    [profileId, load],
  );

  const undo = useCallback(
    async (batchId: number) => {
      const res = await authFetch(
        `${getApiBaseUrl()}/api/import-batches/${batchId}`,
        { method: 'DELETE' },
      );
      if (res.status === 401) {
        setNeedsLogin(true);
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.kept_confirmed) {
        setError(
          `${body.removed} pending rows removed. ${body.kept_confirmed} you had ` +
            'already saved were kept as real transactions.',
        );
      }
      setResult(null);
      load();
    },
    [load],
  );

  if (needsLogin) {
    return (
      <LoginModal
        reason="Your session expired. Sign in to import a statement."
        onSuccess={() => {
          setNeedsLogin(false);
          load();
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4">
      <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
        Import a statement
      </h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
        Download the transactions export from your bank or card issuer and drop
        it here. Anything missing from your tracker gets queued for review —
        nothing is added without you seeing it first.
      </p>

      {profiles.length > 0 && (
        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-gray-700 dark:text-gray-200">
            Which account is this from?
          </span>
          <select
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-700 px-3 py-2
                       text-gray-800 dark:text-gray-100"
          >
            <option value="">Not sure / not listed</option>
            {profiles.filter(p => p.active).map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.kind})
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
            Picking a bank account lets us suppress its monthly card charge, so
            those purchases are not counted twice.
          </span>
        </label>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) submit(file);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging
            ? 'border-blue-500 bg-blue-50 dark:bg-gray-700'
            : 'border-gray-300 dark:border-gray-600'
        }`}
      >
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
          {busy ? 'Reading the statement…' : 'Drop an .xlsx or .csv export here'}
        </p>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.xlsm,.csv,.txt"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) submit(file);
          }}
          className="text-sm"
        />
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Legacy .xls is not supported — open it and save as .xlsx first.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-100 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {result && <ImportSummary result={result} onReview={() => router.push('/review')} />}

      {batches.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-100">
            Recent imports
          </h2>
          <ul className="space-y-2">
            {batches.map(b => (
              <li
                key={b.id}
                className="flex items-center justify-between rounded-lg border
                           border-gray-200 dark:border-gray-700 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-gray-800 dark:text-gray-100">
                    {b.source_profile_name || b.source}
                  </span>
                  <span className="ml-2 text-gray-500 dark:text-gray-400">
                    {b.window_start} → {b.window_end}
                  </span>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {b.proposed} missing · {b.matched} matched
                    {b.suppressed ? ` · ${b.suppressed} suppressed` : ''}
                    {b.ambiguous ? ` · ${b.ambiguous} unclear` : ''}
                  </div>
                </div>
                <button
                  onClick={() => undo(b.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-sm">
        <a href="/settings/accounts" className="text-blue-600 hover:underline">
          Manage banks and cards →
        </a>
      </p>
    </div>
  );
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function ImportSummary({
  result,
  onReview,
}: {
  result: UploadResult;
  onReview: () => void;
}) {
  const b = result.batch;

  return (
    <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
      <p className="font-semibold text-green-900">
        {b.proposed} missing, {b.matched} already tracked
      </p>
      <ul className="mt-2 space-y-0.5 text-sm text-green-900">
        <li>{plural(b.received, 'row')} read from the file</li>
        {result.duplicates_skipped > 0 && (
          <li>{result.duplicates_skipped} already imported previously</li>
        )}
        {b.suppressed > 0 && (
          <li>
            {b.suppressed} suppressed as card settlement or pending charges
          </li>
        )}
        {b.ambiguous > 0 && (
          <li>{b.ambiguous} could not be matched confidently — you decide</li>
        )}
        {result.unreadable_rows > 0 && (
          <li className="text-green-800">
            {plural(result.unreadable_rows, 'row')} skipped as totals, headers
            or blanks
          </li>
        )}
      </ul>

      {b.proposed + b.ambiguous > 0 ? (
        <button
          onClick={onReview}
          className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white
                     hover:bg-blue-700"
        >
          Review {b.proposed + b.ambiguous} now
        </button>
      ) : (
        <p className="mt-3 text-sm text-green-900">
          Nothing was missing — your tracker already had all of it.
        </p>
      )}
    </div>
  );
}
