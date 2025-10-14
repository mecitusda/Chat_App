import React, { useState, useEffect } from "react";
import { useUser } from "../contextAPI/UserContext";
import { removeFriend } from "../slices/friendSlice";
import { useDispatch, useSelector } from "react-redux";
import { useOutletContext } from "react-router";

export default function FriendsList({ socket, onOpenProfile }) {
  const { user } = useUser();
  const [contextMenu, setContextMenu] = useState(null); // { x, y, friendId }
  const { requests, friends } = useSelector((state) => state.friends);
  const { showNotification } = useOutletContext();
  const dispatch = useDispatch();
  // Sağ tık → menüyü aç
  const handleContextMenu = (e, friendId) => {
    e.preventDefault();
    setContextMenu({
      x: e.pageX,
      y: e.pageY,
      friendId,
    });
  };

  // Arkadaşı sil
  const handleRemove = () => {
    if (!contextMenu?.friendId) return;
    socket.emit(
      "friends:remove",
      { userId: user._id, friendId: contextMenu.friendId },
      (resp) => {
        if (!resp?.success) {
          showNotification(resp?.message || "Arkadaş silinemedi");
        } else {
          dispatch(removeFriend(resp.friendId));
          showNotification(resp?.message || "Arkadaş silinemedi");
        }
      }
    );
    setContextMenu(null);
  };

  // Menü dışına tıklanınca kapat
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [contextMenu]);

  return (
    <div className="friends__list" style={{ marginTop: 16 }}>
      <h3>Arkadaşlar</h3>
      {friends.length === 0 ? (
        <div className="empty">Henüz arkadaş yok</div>
      ) : (
        friends.map((f) => (
          <div
            key={f._id}
            className="friend-item"
            onClick={() => onOpenProfile(f)} // sol tık → profil aç
            onContextMenu={(e) => handleContextMenu(e, f._id)} // sağ tık → menü aç
          >
            <div className="left">
              <img
                src={f?.avatar?.url || "/images/default-avatar.jpg"}
                alt=""
                width={36}
                height={36}
                style={{ borderRadius: 8, objectFit: "cover" }}
              />
              <div className="meta">
                <div className="name">{f?.username}</div>
                <div className="about">{f?.about || ""}</div>
                <div className="phone">{f?.phone || ""}</div>
              </div>
            </div>
          </div>
        ))
      )}

      {/* Sağ tık menüsü */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
            position: "absolute",
            background: "#2a2a2a",
            border: "1px solid #444",
            borderRadius: 4,
            padding: "1rem 3rem",
            zIndex: 1000,
            color: "white",
            cursor: "pointer",
          }}
          onClick={handleRemove}
        >
          ❌ Arkadaşı Sil
        </div>
      )}
    </div>
  );
}
