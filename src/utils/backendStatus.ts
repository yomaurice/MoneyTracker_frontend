import { getApiBaseUrl } from './api_base';

export async function waitForBackend(
  timeoutMs = 20000,
  intervalMs = 2000
): Promise<boolean> {
  const start = Date.now();
  const baseUrl = getApiBaseUrl();

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(
        `${baseUrl}/api/health`,
        { cache: 'no-store' }
      );
      if (res.ok) return true;
    } catch (_) {}

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return false;
}
