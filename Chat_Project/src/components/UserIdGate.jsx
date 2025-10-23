import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../contextAPI/UserContext.jsx";

export default function UserIdGate({
  handleClick,
  setResetEnabled, // kullanılmıyor ama bırakalım istersek
  setActiveConversation,
  setactiveConversationId,
}) {
  const { setUser, clearUser } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return; // yeniden mount edilirse tekrar çağrılmasın
    checkedRef.current = true;

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
          `${import.meta.env.VITE_BACKEND_URL}/api/user/me`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();

        if (data?.success && data?.user) {
          setUser(data.user);
        } else {
          handleClick();
          clearUser();
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

    checkAuth();
  }, [
    clearUser,
    setUser,
    navigate,
    handleClick,
    setActiveConversation,
    setactiveConversationId,
  ]);

  if (loading) {
    return (
      <div className="auth-loader">
        <div className="spinner"></div>
        <p>Oturum doğrulanıyor...</p>
      </div>
    );
  }

  return null;
}
