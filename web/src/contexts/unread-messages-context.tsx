"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "./auth-context";
import { api } from "@/lib/api";

interface UnreadMessagesContextValue {
  unreadCount: number;
  refresh: () => void;
}

const UnreadMessagesContext = createContext<UnreadMessagesContextValue>({
  unreadCount: 0,
  refresh: () => {},
});

export function UnreadMessagesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    if (!user) return;
    api.get("/messages/unread-count")
      .then(({ data }) => setUnreadCount(data?.count ?? 0))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    refresh();
    intervalRef.current = setInterval(refresh, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [user, refresh]);

  return (
    <UnreadMessagesContext.Provider value={{ unreadCount, refresh }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

export const useUnreadMessages = () => useContext(UnreadMessagesContext);
