/**
 * Saves from the /add page that have not reached the server yet.
 *
 * A wallet save happens seconds after paying, often against a backend that is
 * asleep or a phone that is offline. Rather than lose the expense, the page
 * keeps the request here and the app retries it the next time it opens. The
 * server keys each save on the notification's timestamp, so a retry of a save
 * that did land is answered "already saved", never duplicated.
 */
import { authFetch } from './auth_fetch';
import { getApiBaseUrl } from './api_base';

const KEY = 'walletDrafts';

export type WalletDraft = Record<string, unknown> & { ts?: string };

function read(): WalletDraft[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(drafts: WalletDraft[]) {
  try {
    if (drafts.length) localStorage.setItem(KEY, JSON.stringify(drafts));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: nothing more we can do */
  }
}

const sameDraft = (a: WalletDraft, b: WalletDraft) =>
  a.ts === b.ts && a.title === b.title && a.text === b.text;

export function queueDraft(draft: WalletDraft) {
  write([...read().filter(d => !sameDraft(d, draft)), draft]);
}

export function pendingDrafts(): number {
  return read().length;
}

export type SaveOutcome =
  | { kind: 'saved' }
  | { kind: 'already' }
  | { kind: 'matched'; matched: any }
  | { kind: 'login' }
  | { kind: 'invalid'; message: string }
  | { kind: 'offline' };

/** One attempt to save a wallet expense. */
export async function saveWallet(body: WalletDraft): Promise<SaveOutcome> {
  let res: Response;
  try {
    res = await authFetch(`${getApiBaseUrl()}/api/ingest/wallet/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: 'offline' };
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 201) return { kind: 'saved' };
  if (res.status === 200 && data.already) return { kind: 'already' };
  if (res.status === 409) return { kind: 'matched', matched: data.matched };
  if (res.status === 401) return { kind: 'login' };
  if (res.status === 400) return { kind: 'invalid', message: data.message || 'Invalid' };
  // 5xx, or the proxy giving up on a cold backend.
  return { kind: 'offline' };
}

/**
 * Retry every queued save. Called when the app opens. A draft the server
 * finds already tracked -- saved earlier, or typed in by hand meanwhile -- is
 * dropped: there is nobody on the page to ask "save anyway?", and dropping
 * cannot lose the expense, since it is in the data either way.
 */
export async function flushDrafts(): Promise<number> {
  const drafts = read();
  if (!drafts.length) return 0;

  let sent = 0;
  const keep: WalletDraft[] = [];
  for (const draft of drafts) {
    const outcome = await saveWallet(draft);
    if (outcome.kind === 'offline' || outcome.kind === 'login') {
      keep.push(draft);
    } else if (outcome.kind === 'saved') {
      sent++;
    }
  }
  write(keep);
  return sent;
}
