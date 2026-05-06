export function getApiBaseUrl() {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
  }

  const host = window.location.hostname;

  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:5000";
  }

  // Production: use relative paths so requests are proxied via Next.js rewrites
  return "";
}


// A simple constant (commonly used)
export const API_BASE_URL = getApiBaseUrl();
