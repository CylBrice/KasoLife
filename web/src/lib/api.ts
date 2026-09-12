import axios from "axios";

// ─── Token en mémoire uniquement ───────────────────────────────────────────
// Le refresh token vit dans un cookie HttpOnly géré par Next.js (invisible au JS).
// L'access token (JWT 15 min) vit ici, en mémoire — jamais dans localStorage ni cookie.
// Un rechargement de page déclenche un appel /api/auth/refresh pour le restaurer.

let _token: string | null = null;
// Promise partagée pour éviter d'envoyer plusieurs requêtes refresh simultanément
let _refreshing: Promise<string | null> | null = null;
// Bloque tout nouveau refresh après un échec — réarmé par setApiToken (nouveau login)
let _refreshFailed = false;

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

// Rafraîchit l'access token via le BFF (cookie HttpOnly). Une seule requête
// en vol à la fois : AuthProvider et l'interceptor partagent la même promesse.
// Le backend fait tourner le refresh token à chaque appel — deux refresh
// concurrents avec le même cookie provoquent un 401 (token déjà révoqué).
export function refreshAccessToken(): Promise<string | null> {
  if (_refreshFailed) return Promise.resolve(null);
  if (!_refreshing) {
    _refreshing = fetch("/api/auth/refresh", { method: "POST" })
      .then(async (r) => {
        if (!r.ok) return null;
        const d = await r.json();
        return (d.accessToken as string) ?? null;
      })
      .catch(() => null)
      .then((token) => {
        if (token) {
          _token = token;
          _refreshFailed = false;
        } else {
          _refreshFailed = true;
        }
        return token;
      })
      .finally(() => { _refreshing = null; });
  }
  return _refreshing;
}

// Sur 401 : tente un refresh silencieux, puis rejoue la requête originale.
// Si le refresh échoue → événement global → AuthProvider redirige vers /connexion.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry || _refreshFailed) return Promise.reject(error);
    original._retry = true;

    const newToken = await refreshAccessToken();

    if (!newToken) {
      _token = null;
      if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
      return Promise.reject(error);
    }

    original.headers.Authorization = `Bearer ${newToken}`;
    return api(original);
  }
);

export function setApiToken(token: string) { _token = token; _refreshFailed = false; }
export function clearApiToken() { _token = null; }
export function getApiToken(): string | null { return _token; }
