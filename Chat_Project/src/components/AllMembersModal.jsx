import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "@mui/material/Avatar";
import formatPhone from "../utils/formatPhone";

export default function AllMembersModal({ show, onClose, members = [] }) {
  const [visible, setVisible] = useState(show);
  const [animClass, setAnimClass] = useState(""); // "is-open" | "is-closing"
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (show) {
      setVisible(true);
      setAnimClass(""); // önce resetle
      // Bir sonraki frame’de open class’ını ver
      const t = setTimeout(() => setAnimClass("is-open"), 20);
      return () => clearTimeout(t);
    } else if (visible) {
      setAnimClass("is-closing");
      const t = setTimeout(() => setVisible(false), 350);
      return () => clearTimeout(t);
    }
  }, [show]);

  const grouped = useMemo(() => {
    const cleanedQuery = query.trim().toLowerCase();
    const numericQuery = query.replace(/\D/g, "");
    const filtered = members.filter((m) => {
      const u = m.user || m;
      const name = (u?.username || "").toLowerCase();
      const phone = u?.phone || "";
      if (!cleanedQuery) return true;
      const hasLetters = /[a-zA-ZğüşöçıİĞÜŞÖÇ]/.test(cleanedQuery);
      if (hasLetters) return name.includes(cleanedQuery);
      if (numericQuery.length > 0) return phone.includes(numericQuery);
      return false;
    });

    const sorted = filtered.sort((a, b) =>
      (a.user?.username || "").localeCompare(b.user?.username || "")
    );

    const groups = {};
    sorted.forEach((m) => {
      const u = m.user || m;
      const letter = (u?.username?.charAt(0) || "B").toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(m);
    });
    return groups;
  }, [members, query]);

  if (!visible) return null;

  return createPortal(
    <div className={`all-members-overlay ${animClass}`} onClick={onClose}>
      <div className="all-members-modal" onClick={(e) => e.stopPropagation()}>
        <div className="all-members-header">
          <h3>Katılımcılar</h3>
          <button className="close-btn" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="all-members-search">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            placeholder="Üye ara..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="all-members-content">
          {Object.entries(grouped).length === 0 && (
            <div className="empty-state">Sonuç bulunamadı.</div>
          )}

          {Object.entries(grouped).map(([letter, users]) => (
            <div key={letter} className="letter-group">
              <div className="letter-title">{letter}</div>
              {users.map((m) => {
                const u = m.user;
                return (
                  <div key={u._id} className="member-row">
                    <Avatar
                      alt={u.username}
                      src={u.avatar?.url || "/images/default-avatar.jpg"}
                      sx={{ width: 42, height: 42, flexShrink: 0 }}
                    />
                    <div className="member-details">
                      <div className="member-top">
                        <span className="member-name">{u.username}</span>
                      </div>
                      <div className="member-bottom">
                        {u.about ? (
                          <span className="member-about">{u.about}</span>
                        ) : (
                          <span className="member-about muted">
                            Sadece acil aramalar.
                          </span>
                        )}
                        {u.phone && (
                          <span className="member-phone">
                            {formatPhone(u.phone)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
