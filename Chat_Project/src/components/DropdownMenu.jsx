// DropdownMenu.jsx
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useUser } from "../contextAPI/UserContext";
import CreateGroupModal from "./CreateGroupModal"; // 👈 Modalı import et
import { resetFile } from "../slices/fileSlice.js";
import { resetMessages } from "../slices/messageSlice.js";
import { resetFriends } from "../slices/friendSlice.js";
import { resetAllPagination } from "../slices/paginationSlice.js";
import { resetConversation } from "../slices/conversationSlice.js";
import { useDispatch } from "react-redux";
export default function DropdownMenu({ socket, showNotification }) {
  const [open, setOpen] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false); // 👈 modal state
  const ref = useRef(null);
  const navigate = useNavigate();
  const { clearUser } = useUser();
  const {
    handleClick,
    setResetEnabled,
    setActiveConversation,
    setactiveConversationId,
  } = useOutletContext();

  const toggleMenu = () => setOpen(!open);
  const dispatch = useDispatch();
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
      dispatch(resetConversation());
      dispatch(resetMessages());
      dispatch(resetFile());
      dispatch(resetFriends());
      dispatch(resetAllPagination());
      setActiveConversation(null);
      setactiveConversationId(null);
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
          <button onClick={() => setShowGroupModal(true)}>
            ➕ Grup Oluştur
          </button>
          <button onClick={handleLogout}>🚪 Çıkış Yap</button>
        </div>
      )}

      {/* Modal */}
      {showGroupModal && (
        <CreateGroupModal
          onClose={() => setShowGroupModal(false)}
          socket={socket}
          showNotification={showNotification}
        />
      )}
    </div>
  );
}
