import axios from "axios";

// ─── Token en mémoire uniquement ───────────────────────────────────────────
// Le refresh token vit dans un cookie HttpOnly géré par Next.js (invisible au JS).
// L'access token (JWT 15 min) vit ici, en mémoire — jamais dans localStorage ni cookie.
// Un rechargement de page déclenche un appel /api/auth/refresh pour le restaurer.

let _token: string | null = null;
// Promise partagée pour éviter d'envoyer plusieurs requêtes refresh simultanément
let _refreshing: Promise<string | null> | null = null;

export const AUTH_UNAUTHORIZED_EVENT = "kasolife:unauthorized";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
  timeout: 15_000,
});

// Injecte le Bearer token sur chaque requête
api.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`;
  return config;
});

// Sur 401 : tente un refresh silencieux, puis rejoue la requête originale.
// Si le refresh échoue → événement global → AuthProvider redirige vers /connexion.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) return Promise.reject(error);
    original._retry = true;

    if (!_refreshing) {
      _refreshing = fetch("/api/auth/refresh", { method: "POST" })
        .then(async (r) => {
          if (!r.ok) throw new Error("refresh_failed");
          const d = await r.json();
          return d.accessToken as string;
        })
        .catch(() => null)
        .finally(() => { _refreshing = null; });
    }

    const newToken = await _refreshing;

    if (!newToken) {
      _token = null;
      if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
      return Promise.reject(error);
    }

    _token = newToken;
    original.headers.Authorization = `Bearer ${newToken}`;
    return api(original);
  }
);

export function setApiToken(token: string) { _token = token; }
export function clearApiToken() { _token = null; }
export function getApiToken(): string | null { return _token; }
