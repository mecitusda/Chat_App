import { useContext } from "react";
import { Navigate, Outlet } from "react-router";
// import { userContext } from "../contexts/UserContext";
// Sadece giriş yapmış kullanıcılar erişsin
export function ProtectedRoute() {
  //   const { user } = useContext(userContext);

  //   return user ? <Outlet /> : <Navigate to="/giriş" replace />;
  return <Outlet />;
}

// Sadece giriş yapmamış kullanıcılar erişsin
export function GuestRoute() {
  //   const { user } = useContext(userContext);

  //   return !user ? <Outlet /> : <Navigate to="/" replace />;
  return <Outlet />;
}
