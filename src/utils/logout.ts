import { getApiBaseUrl } from './api_base';

export const logout = async () => {
  try {
    await fetch(`${getApiBaseUrl()}/api/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (err) {
    console.error('Logout request failed', err);
  } finally {
    // Clear any auth settling flags
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('authSettling');
    }

    // Force navigation to login
    window.location.href = '/login';
  }
};
