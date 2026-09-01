import axios from "axios";
import Cookies from "js-cookie";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
  timeout: 15000,
});

/** Événement émis quand une requête échoue en 401 — AuthProvider s'y abonne
 * pour vider son état et rediriger, au lieu de laisser l'UI croire à tort
 * que l'utilisateur est toujours connecté. */
export const AUTH_UNAUTHORIZED_EVENT = "kasolife:unauthorized";

// Attache le token JWT à chaque requête si présent
api.interceptors.request.use((config) => {
  const token = Cookies.get("kasolife_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Sur 401, nettoie la session locale et notifie l'app (AuthProvider redirige)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove("kasolife_token");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
      }
    }
    return Promise.reject(error);
  }
);

export function setAuthToken(token: string) {
  Cookies.set("kasolife_token", token, { expires: 30, sameSite: "lax" });
}

export function clearAuthToken() {
  Cookies.remove("kasolife_token");
}

export function getAuthToken(): string | undefined {
  return Cookies.get("kasolife_token");
}
