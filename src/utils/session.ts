import { getApiBaseUrl } from './api_base';

/**
 * Keeps the access token alive ahead of time instead of waiting for a 401.
 *
 * authFetch already recovers from an expired access token, but reactively: the
 * first request after the 15-minute window fails, then refreshes, then retries.
 * That is three round-trips against a backend that may be cold, on exactly the
 * request the user is waiting for. Refreshing when the app opens or regains
 * focus moves that cost to a moment when nobody is watching.
 */

const ACCESS_TOKEN_LIFETIME_MS = 15 * 60 * 1000;

// Refresh once the token is more than half spent. Frequent enough that a
// focused tab never carries a stale token, rare enough not to churn the
// refresh-token chain on every tab switch.
const REFRESH_AFTER_MS = ACCESS_TOKEN_LIFETIME_MS / 2;

// Floor on how often a refresh is even attempted. Without it, a logged-out or
// offline app retries on every mount, focus and visibility change -- and since
// the backend rotates refresh tokens, each needless attempt spends one.
const MIN_ATTEMPT_INTERVAL_MS = 30 * 1000;

const LAST_REFRESH_KEY = 'lastSessionRefresh';
const LAST_ATTEMPT_KEY = 'lastSessionRefreshAttempt';

let inFlight: Promise<boolean> | null = null;

function readStamp(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    // Private mode, or site data blocked. Treat as "never" -- the throttle is
    // an optimisation, not a correctness requirement.
    return 0;
  }
}

function writeStamp(key: string, at: number) {
  try {
    localStorage.setItem(key, String(at));
  } catch {
    /* ignore */
  }
}

function readLastRefresh(): number {
  return readStamp(LAST_REFRESH_KEY);
}

function writeLastRefresh(at: number) {
  writeStamp(LAST_REFRESH_KEY, at);
}

/**
 * Exchange the refresh cookie for a fresh access token.
 *
 * Concurrent callers share one request. That matters because the backend
 * rotates refresh tokens: two simultaneous refreshes would present the same
 * token, and while the server tolerates that within a grace window, not firing
 * twice in the first place is better.
 */
export async function refreshSession(): Promise<boolean> {
  if (inFlight) return inFlight;

  // Recorded before the request, and for failures too, so a rejected refresh
  // is not retried on the very next event.
  writeStamp(LAST_ATTEMPT_KEY, Date.now());

  inFlight = (async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        writeLastRefresh(Date.now());
        return true;
      }
      return false;
    } catch {
      // Offline, or the backend is still waking. Not fatal: authFetch will
      // retry on the next real request.
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * Record that the session was just established, so the keepalive does not
 * immediately spend a refresh token on cookies that are seconds old. Call
 * after a successful login.
 */
export function markSessionFresh() {
  writeLastRefresh(Date.now());
}

/** Refresh only if the current access token is likely past its half-life. */
export async function refreshSessionIfStale(): Promise<boolean> {
  const now = Date.now();
  if (now - readLastRefresh() < REFRESH_AFTER_MS) return true;
  if (now - readStamp(LAST_ATTEMPT_KEY) < MIN_ATTEMPT_INTERVAL_MS) return false;
  return refreshSession();
}

/**
 * Start keeping this tab's session warm. Returns a cleanup function.
 *
 * Call once from the app shell. Safe to call when logged out: a failed refresh
 * changes nothing, and the existing auth checks still drive the redirect.
 */
export function startSessionKeepalive(): () => void {
  if (typeof window === 'undefined') return () => {};

  // On open the access cookie has usually expired while the app was closed,
  // which is the case that used to end in a login screen. The staleness check
  // keeps a quick reload or a post-login redirect from spending a token.
  void refreshSessionIfStale();

  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      void refreshSessionIfStale();
    }
  };

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);

  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
  };
}
