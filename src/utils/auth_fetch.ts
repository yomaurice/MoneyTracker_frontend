const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export const authFetch = async (
  url: string,
  options: RequestInit = {},
  skipRedirect = false
) => {
  // 1️⃣ First attempt: normal request (cookies auto-attached)
  let res = await fetch(url, {
    ...options,
    credentials: 'include', // ✅ REQUIRED
  });

  // 2️⃣ If access token expired → try refresh ONCE
  if (res.status === 401) {
    const refreshRes = await fetch(`${API_BASE_URL}/api/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    // ✅ Refresh succeeded → retry original request
    if (refreshRes.ok) {
      res = await fetch(url, {
        ...options,
        credentials: 'include',
      });
      return res;
    }

    // ❌ Refresh failed → user is really logged out
    if (!skipRedirect && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  return res;
};
