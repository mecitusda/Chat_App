import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const UserContext = createContext(null);

export function UserContextProvider({ children }) {
  // ✅ SSR-safe initial load + parse guard
  const [user, setUser] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const storedUser = localStorage.getItem("user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  // ✅ localStorage senkronizasyonu (token dahil)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
  }, [user]);

  // ✅ temiz çıkış (logout)
  const clearUser = () => {
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    } catch (err) {
      console.warn("localStorage temizlenemedi:", err);
    }
    setUser(null);
  };

  // ✅ stabilize context referansı — gereksiz render’ları önler
  const value = useMemo(() => ({ user, setUser, clearUser }), [user]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx)
    throw new Error("useUser must be used inside <UserContextProvider>");
  return ctx;
}
