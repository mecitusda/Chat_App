import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import { useUser } from "../contextAPI/UserContext";
import { addOrUpdateConversations } from "../slices/conversationSlice";
export default function CreateGroupModal({
  onClose,
  socket,
  showNotification,
}) {
  const friends = useSelector((s) => s.friends.friends || []); // redux friend list
  const [groupName, setGroupName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [avatarFile, setAvatarFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const dispatch = useDispatch();
  const { user } = useUser();
  // İlk yükleme → listeyi çek
  useEffect(() => {
    if (!socket || !user?._id) return;
    socket.emit("friends:list:get", { userId: user._id });
  }, [socket, user?._id]);

  const toggleFriend = (id) => {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // 📌 Avatar seçme
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setPreview(URL.createObjectURL(file)); // geçici gösterim
    }
  };

  // 📌 Grup oluştur
  const handleSubmit = async () => {
    if (!groupName.trim() || selectedFriends.length === 0) {
      alert("Lütfen grup adı ve en az 1 arkadaş seçin.");
      return;
    }

    let avatarKey = "";
    try {
      if (avatarFile) {
        // 1) Presigned URL al
        const { data } = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/api/file/presigned-url/group`,
          {
            params: { fileType: avatarFile.type },
          }
        );

        const { uploadUrl, key } = data;
        // 2) Dosyayı yükle
        await axios.put(uploadUrl, avatarFile, {
          headers: { "Content-Type": avatarFile.type },
        });

        avatarKey = key;
      }

      // 3) Socket ile backend’e bildir
      socket.emit(
        "conversation:create-group",
        {
          userId: user._id,
          name: groupName,
          members: selectedFriends,
          avatarKey,
          createdBy: user._id,
        },
        (resp) => {
          if (resp.success) {
            showNotification("🔔Grup başarıyla kuruldu.");
            dispatch(addOrUpdateConversations(resp.conversation));
          }
        }
      );

      onClose();
    } catch (err) {
      console.error("Grup oluşturulamadı:", err);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2>Yeni Grup</h2>

        {/* Grup Avatarı */}
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

        {/* Arkadaş seçimi */}
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
          <button onClick={handleSubmit}>Oluştur</button>
          <button onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}
