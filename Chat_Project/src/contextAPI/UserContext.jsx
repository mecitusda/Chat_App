import React, { createContext, useContext, useEffect, useState } from "react";

const UserContext = createContext(null);

export function UserContextProvider({ children }) {
  const [userId, setUserId] = useState(() => {
    return localStorage.getItem("chat_user_id") || "";
  });

  useEffect(() => {
    if (userId) localStorage.setItem("chat_user_id", userId);
  }, [userId]);

  const clearUserId = () => {
    localStorage.removeItem("chat_user_id");
    setUserId("");
  };

  return (
    <UserContext.Provider value={{ userId, setUserId, clearUserId }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserId() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUserId must be used inside <UserIdProvider>");
  return ctx;
}
