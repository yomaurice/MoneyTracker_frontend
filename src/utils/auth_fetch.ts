const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

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

    const refreshRes = await fetch(`${API_BASE_URL}/api/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    console.log('[authFetch] refresh →', refreshRes.status);

    if (refreshRes.ok) {
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
