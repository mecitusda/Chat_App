import React, { createContext, useContext, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { upsertFiles } from "../slices/fileSlice";
const UserContext = createContext(null);

export function UserContextProvider({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  const clearUserId = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, setUser, clearUserId }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx)
    throw new Error("useUser must be used inside <UserContextProvider>");
  return ctx;
}
