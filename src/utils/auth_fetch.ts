export const authFetch = (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token')
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    credentials: 'include',
  })
}