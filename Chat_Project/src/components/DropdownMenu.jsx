import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useUser } from "../contextAPI/UserContext";

export default function DropdownMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { clearUser } = useUser();
  const {
    handleClick,
    setResetEnabled,
    setActiveConversation,
    setactiveConversationId,
    showNotification,
  } = useOutletContext();
  const toggleMenu = () => setOpen(!open);

  // Menü dışına tıklayınca kapansın
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/logout`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResetEnabled(true);
      handleClick();
      setActiveConversation(null), setactiveConversationId(null);
      clearUser();
      showNotification("🔔Başarıyla çıkış yapıldı.");
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <div className="dropdown" ref={ref}>
      <button onClick={toggleMenu} className="dropdown-trigger">
        ⋮
      </button>
      {open && (
        <div className="dropdown-menu">
          <button onClick={handleLogout}>Çıkış Yap</button>
        </div>
      )}
    </div>
  );
}
