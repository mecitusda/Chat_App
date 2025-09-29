import { useContext } from "react";
import { Navigate, Outlet, useOutletContext } from "react-router";
import { useUser } from "../contextAPI/UserContext";

// import { userContext } from "../contexts/UserContext";
// Sadece giriş yapmış kullanıcılar erişsin
export function ProtectedRoute() {
  const { user } = useUser();
  const parentContext = useOutletContext(); // MainLayout’tan gelen context
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet context={parentContext} />;
}

// Sadece giriş yapmamış kullanıcılar erişsin
export function AuthRoute() {
  const { user } = useUser();
  const parentContext = useOutletContext();

  if (user) {
    return <Navigate to="/chat" replace />;
  }

  return <Outlet context={parentContext} />;
}
