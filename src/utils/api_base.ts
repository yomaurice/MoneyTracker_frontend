// utils/api_base.ts

export function getApiBaseUrl() {
  // SSR fallback (Next.js renders on server side first)
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }

  const host = window.location.hostname;

  // Custom domain
  if (host.includes("trackex.store")) {
    return "https://money-tracker-backend.onrender.com";
  }

  // Vercel production domain
  if (host.includes("vercel.app")) {
    return "https://money-tracker-backend.onrender.com";
  }

  // Local development
  return "http://localhost:5000";
}

// A simple constant (commonly used)
export const API_BASE_URL = getApiBaseUrl();
