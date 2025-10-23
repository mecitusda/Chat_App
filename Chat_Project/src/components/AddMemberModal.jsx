import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { createPortal } from "react-dom";
import Avatar from "@mui/material/Avatar";
import formatPhone from "../utils/formatPhone";

export default function AddMemberModal({
  show,
  conversation,
  onClose,
  meId,
  socket,
  onAdded,
  showNotification,
}) {
  const friends = useSelector((s) => s.friends.friends || []);
  const [selected, setSelected] = useState([]);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [animClass, setAnimClass] = useState("");
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setVisible(true);
      setAnimClass("");
      const t = setTimeout(() => setAnimClass("is-open"), 20);
      return () => clearTimeout(t);
    } else if (visible) {
      setAnimClass("is-closing");
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, [show]);

  const filteredFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    const numeric = query.replace(/\D/g, "");
    return friends.filter((f) => {
      if (conversation.members.some((m) => m.user._id === f._id)) return false;
      const name = (f.username || "").toLowerCase();
      const phone = f.phone || "";
      if (!q) return true;
      const hasLetters = /[a-zA-ZğüşöçıİĞÜŞÖÇ]/.test(q);
      if (hasLetters) return name.includes(q);
      if (numeric.length > 0) return phone.includes(numeric);
      return false;
    });
  }, [friends, conversation.members, query]);

  const handleToggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAdd = () => {
    if (!selected.length) return;
    setAdding(true);
    socket.emit(
      "conversation:new-user",
      {
        conversationId: conversation._id,
        userId: meId,
        addMembers: selected,
      },
      (res) => {
        setAdding(false);
        if (res.success) {
          onAdded?.(res.conversation);
          showNotification("✅ Üyeler başarıyla eklendi.");
          handleClose();
        } else {
          showNotification("❌ Üyeler eklenemedi.");
        }
      }
    );
  };

  const handleClose = () => {
    setAnimClass("is-closing");
    setTimeout(() => {
      onClose();
      setSelected([]);
      setQuery("");
    }, 300);
  };

  if (!visible) return null;

  return createPortal(
    <div className={`add-member-overlay ${animClass}`} onClick={handleClose}>
      <div className="add-member-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-member-header">
          <h3>Üye Ekle</h3>
          <button className="close-btn" onClick={handleClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* 🔍 Arama kutusu */}
        <div className="add-member-search">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            placeholder="Arkadaş ara..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* 📋 Liste */}
        <div className="add-member-list">
          {filteredFriends.length ? (
            filteredFriends.map((f) => (
              <label key={f._id} className="add-member-item">
                <div className="modal__friend-info">
                  <Avatar
                    src={f.avatar?.url || "/images/default-avatar.jpg"}
                    alt={f.username}
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      flexShrink: 0,
                    }}
                  />
                  <div className="friend-info-text">
                    <div className="friend-top">
                      <span className="friend-name">{f.username}</span>
                    </div>
                    <div className="friend-bottom">
                      {f.about ? (
                        <span className="friend-about">{f.about}</span>
                      ) : (
                        <span className="friend-about muted">
                          Sadece acil aramalar.
                        </span>
                      )}
                      {f.phone && (
                        <span className="friend-phone">
                          {formatPhone(f.phone)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={selected.includes(f._id)}
                  onChange={() => handleToggle(f._id)}
                />
              </label>
            ))
          ) : (
            <p className="empty-state">Tüm arkadaşların bu grupta zaten.</p>
          )}
        </div>

        {/* Butonlar */}
        <div className="add-member-actions">
          <button className="cancel-btn" onClick={handleClose}>
            İptal
          </button>
          <button
            className="add-btn"
            onClick={handleAdd}
            disabled={!selected.length || adding}
          >
            {adding ? "Ekleniyor..." : `Ekle (${selected.length || 0})`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
