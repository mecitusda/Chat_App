import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../contextAPI/UserContext.jsx";

export default function UserIdGate({
  handleClick,
  setResetEnabled,
  setActiveConversation,
  setactiveConversationId,
}) {
  const { setUser, clearUser } = useUser(); // 👈 senin context'teki isimler
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        clearUser();
        setLoading(false);
        navigate("/login", { replace: true });
        return;
      }

      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/auth/me`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();

        if (data.success) {
          setUser(data.user); // 👈 user’ı context’e kaydet
        } else {
          setResetEnabled(true);
          handleClick();
          clearUser(); // 👈 user’ı sıfırla
          setActiveConversation(null);
          setactiveConversationId(null);
          navigate("/login", { replace: true });
        }
      } catch (err) {
        console.error("Auth kontrolü hatası:", err);
        clearUser();
        navigate("/login", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    checkAuth(); // sadece mount’ta çalışır
  }, []);

  if (loading) {
    return <div className="loading">🔄 Giriş kontrol ediliyor...</div>;
  }

  return null;
}
