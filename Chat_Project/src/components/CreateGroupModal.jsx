import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import { useUser } from "../contextAPI/UserContext";
import {
  addOrUpdateConversations,
  setUnread,
} from "../slices/conversationSlice";

export default function CreateGroupModal({
  onClose,
  socket,
  showNotification,
}) {
  const friends = useSelector((s) => s.friends.friends || []);
  const [groupName, setGroupName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [avatarFile, setAvatarFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false); // 🔥 buton kilidi
  const dispatch = useDispatch();
  const { user } = useUser();

  useEffect(() => {
    if (!socket || !user?._id) return;
    socket.emit("friends:list:get", { userId: user._id });
  }, [socket, user?._id]);

  const toggleFriend = (id) => {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Önce eski preview varsa temizle
      if (preview) {
        URL.revokeObjectURL(preview);
      }
      setAvatarFile(file);
      const newUrl = URL.createObjectURL(file);
      setPreview(newUrl);
    }
  };

  // 🧹 component unmount olduğunda da temizle
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleSubmit = async () => {
    if (loading) return; // 🔥 aynı anda iki defa basmayı engelle
    if (!groupName.trim() || selectedFriends.length === 0) {
      showNotification("⚠️ Lütfen grup adı ve en az 1 arkadaş seçin.");
      return;
    }

    setLoading(true); // 🟡 Butonu kilitle

    try {
      let avatarKey = "";

      if (avatarFile) {
        const { data } = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/api/file/presigned-url/group`,
          { params: { fileType: avatarFile.type } }
        );

        await axios.put(data.uploadUrl, avatarFile, {
          headers: { "Content-Type": avatarFile.type },
        });
        avatarKey = data.key;
      }

      socket.emit(
        "conversation:create-group",
        {
          userId: user._id,
          name: groupName.trim(),
          members: selectedFriends,
          avatarKey,
          createdBy: user._id,
        },
        (resp) => {
          setLoading(false); // ✅ Yanıt geldiğinde geri aç
          if (resp.success) {
            showNotification("✅ Grup başarıyla oluşturuldu!");
            dispatch(addOrUpdateConversations(resp.conversation));
            const by = resp.conversation.members.find(
              (m) => m.user._id === user._id
            );
            dispatch(
              setUnread({
                conversationId: resp.conversation._id,
                by: by.unread,
              })
            );
            onClose();
          } else {
            showNotification("⚠️ " + (resp.message || "Bir hata oluştu."));
          }
        }
      );
    } catch (err) {
      console.error("Grup oluşturulamadı:", err);
      showNotification("❌ Sunucu hatası. Tekrar deneyin.");
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2>Yeni Grup</h2>

        <div className="group-avatar-upload">
          <label htmlFor="group-avatar">
            <img
              src={preview || "images/default-avatar.jpg"}
              alt="group avatar"
              className="group-avatar"
            />
          </label>
          <input
            type="file"
            id="group-avatar"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleAvatarChange}
          />
        </div>

        <input
          type="text"
          placeholder="Grup adı"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
        />

        <div className="friends-list">
          {friends.map((f) => (
            <div
              key={f._id}
              className="friend-option"
              onClick={() => toggleFriend(f._id)}
            >
              <input
                type="checkbox"
                checked={selectedFriends.includes(f._id)}
                readOnly
              />
              <img
                src={f.avatar?.url || "images/default-avatar.jpg"}
                alt={f.username}
                className="friend-avatar"
              />
              <div className="friend-info">
                <span className="friend-username">{f.username}</span>
                {f.about && <span className="friend-about">{f.about}</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button onClick={handleSubmit} disabled={loading}>
            {loading ? "Oluşturuluyor..." : "Oluştur"}
          </button>
          <button onClick={onClose} disabled={loading}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
