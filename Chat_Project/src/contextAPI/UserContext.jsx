import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

const UserContext = createContext(null);

export function UserContextProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const storedUser = localStorage.getItem("user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const timeoutId = setTimeout(() => {
      if (user) {
        try {
          localStorage.setItem("user", JSON.stringify(user));
        } catch (err) {
          console.warn("localStorage yazılamadı:", err);
        }
      } else {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
  }, [user]);

  const clearUser = useCallback(() => {
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    } catch (err) {
      console.warn("localStorage temizlenemedi:", err);
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, clearUser }),
    [user, clearUser],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx)
    throw new Error("useUser must be used inside <UserContextProvider>");
  return ctx;
}
