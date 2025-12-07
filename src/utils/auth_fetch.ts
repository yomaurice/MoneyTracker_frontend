export const authFetch = async (
  url: string,
  options: RequestInit = {},
  skipRedirect = false   // ✅ NEW: optional flag
) => {
  const token = localStorage.getItem('token');

  const defaultHeaders: HeadersInit = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
    credentials: 'include',
  });

  // ✅ Determine if we are currently on auth pages
  const isAuthPage =
    typeof window !== 'undefined' &&
    ['/login', '/signup'].includes(window.location.pathname);

  // ✅ Only redirect if:
  // - Unauthorized
  // - NOT skipping redirect
  // - NOT already on login/signup
  if (res.status === 401 && !skipRedirect && !isAuthPage) {
    console.warn('Unauthorized – redirecting to login');
    window.location.href = '/login';
    return res;
  }

  return res;
};

export const logout = () => {
  localStorage.removeItem('token');
  window.location.href = '/login';
};
