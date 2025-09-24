import { useContext } from "react";
import { Navigate, Outlet, useOutletContext } from "react-router";
import { useUser } from "../contextAPI/UserContext";

// import { userContext } from "../contexts/UserContext";
// Sadece giriş yapmış kullanıcılar erişsin
export function ProtectedRoute() {
  const { user } = useUser();
  const parentContext = useOutletContext(); // 👈 MainLayout’tan gelen context

  return user ? (
    <Outlet context={parentContext} />
  ) : (
    <Navigate to="/login" replace />
  );
}

// Sadece giriş yapmamış kullanıcılar erişsin
export function AuthRoute() {
  const { user } = useUser();
  const parentContext = useOutletContext();

  return !user ? (
    <Outlet context={parentContext} />
  ) : (
    <Navigate to="/chat" replace />
  );
}
