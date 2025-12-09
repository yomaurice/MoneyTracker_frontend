const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export const logout = async () => {
  await fetch(`${API_BASE_URL}/api/logout`, {
    method: 'POST',
    credentials: 'include',
  });

  window.location.href = '/login';
};
