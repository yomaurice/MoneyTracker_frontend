import { refreshSession } from './session';

export const authFetch = async (
  url: string,
  options: RequestInit = {},
  skipRedirect = false
) => {
  console.log('[authFetch] request →', url);

  let res = await fetch(url, {
    ...options,
    credentials: 'include',
  });

  console.log('[authFetch] response →', res.status, url);

  if (res.status === 401) {
    console.warn('[authFetch] 401 → trying refresh');

    // Shared with the keepalive, and single-flight: several requests failing
    // at once exchange one refresh token between them instead of one each.
    // That matters now the backend rotates on every refresh -- a burst of
    // independent exchanges would look like token reuse.
    const refreshed = await refreshSession();

    console.log('[authFetch] refresh →', refreshed ? 'ok' : 'failed');

    if (refreshed) {
      console.log('[authFetch] retrying original request');
      res = await fetch(url, {
        ...options,
        credentials: 'include',
      });
      console.log('[authFetch] retry result →', res.status);
      return res;
    }

    console.error('[authFetch] refresh FAILED');

    // 🔕 TEMPORARILY DISABLED REDIRECTS (IMPORTANT)
    /*
    const isAuthCheck = url.endsWith('/api/me');

    const isAuthSettling =
      typeof window !== 'undefined' &&
      sessionStorage.getItem('authSettling') === 'true';

    if (
      !skipRedirect &&
      isAuthCheck &&
      !isAuthSettling &&
      typeof window !== 'undefined'
    ) {
      console.error('[authFetch] redirecting to /login');
      window.location.href = '/login';
    }
    */
  }

  return res;
};
