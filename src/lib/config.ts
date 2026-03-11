/**
 * Central config for backend API URL.
 * Works from localhost, Tailscale IP, or any remote host.
 * The browser always calls :8000 on the same host it loaded the page from.
 */
export const BACKEND_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000");

export const GATEWAY_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:18789`
    : (process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:18789");
