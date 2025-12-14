export function getApiBaseUrl() {
  if (typeof window === "undefined") {
    console.log("[api_base] SSR mode. Using:", process.env.NEXT_PUBLIC_BACKEND_URL);
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }

  const host = window.location.hostname;
  console.log("[api_base] Running in browser:", host);

  if (host.includes("trackex.store")) {
    console.log("[api_base] Using backend for trackex.store");
    return "https://moneytrackerfl.onrender.com";
  }

  if (host.includes("vercel.app")) {
    console.log("[api_base] Using backend for vercel");
    return "https://moneytrackerfl.onrender.com";
  }

  console.log("[api_base] Localhost fallback");
  return "http://localhost:5000";
}


// A simple constant (commonly used)
export const API_BASE_URL = getApiBaseUrl();
