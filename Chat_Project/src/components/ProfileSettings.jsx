import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useUser } from "../contextAPI/UserContext";
import { useMediaUrl } from "../hooks/useMediaUrl";

export default function ProfileSettings() {
  const fileInputRef = useRef(null);
  const { user, setUser } = useUser();
  const [profileImage, setProfileImage] = useState(
    useMediaUrl(user.avatar) || "https://avatar.iran.liara.run/public/49"
  );

  const [newFile, setNewFile] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const [name, setName] = useState(user.username || "");
  const [about, setAbout] = useState(user.about || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingAbout, setIsEditingAbout] = useState(false);

  useEffect(() => {}, [user]);

  // ---- Fotoğraf: dosya seç, preview göster ----
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewFile(file);
    setProfileImage(URL.createObjectURL(file)); // preview
  };

  // ---- Fotoğraf: S3'e yükle + avatar patch ----
  const handleAvatarUpdate = async () => {
    if (!newFile) return;
    try {
      setIsUpdating(true);

      // 1) presigned url al
      const { data } = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/file/presigned-url/profile`,
        {
          params: { user_id: user._id, fileType: newFile.type },
        }
      );
      const { uploadURL, media_key } = data;

      // 2) S3'e yükle (PUT)
      await axios.put(uploadURL, newFile, {
        headers: { "Content-Type": newFile.type },
      });

      // 4) profil patch (sadece avatar)
      const patchResp = await axios.patch(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/profile`,
        {
          user_id: user._id,
          avatar: media_key,
        }
      );

      if (patchResp.data.success) {
        setUser(patchResp.data.user); // 🔥 tüm uygulamada güncel
        setNewFile(null);
      }
      setNewFile(null);
      // burada istersen context'i de güncelle
      // setUser({ ...user, avatar: avatarUrl });
    } catch (err) {
      console.error("Avatar güncelleme hatası:", err);
      alert("Avatar güncellenemedi");
    } finally {
      setIsUpdating(false);
    }
  };

  // ---- İsim güncelle ----
  const handleNameUpdate = async () => {
    try {
      setIsUpdating(true);
      const resp = await axios.patch(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/profile`,
        {
          user_id: user._id,
          username: name,
        }
      );
      if (resp.data.success) {
        setUser(resp.data.user); // context güncellendi
        setIsEditingName(false);
      }
      // setUser({ ...user, username: name });
    } catch (err) {
      console.error(err);
      alert("İsim güncellenemedi");
    } finally {
      setIsUpdating(false);
    }
  };

  // ---- Hakkımda güncelle ----
  const handleAboutUpdate = async () => {
    try {
      setIsUpdating(true);
      const resp = await axios.patch("/api/user/profile", {
        user_id: user._id,
        about,
      });
      if (resp.data.success) {
        setAbout(resp.data.user.about);
        setIsEditingAbout(false);
      }
      // setUser({ ...user, about });
    } catch (err) {
      console.error(err);
      alert("Hakkımda güncellenemedi");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="settings">
      <div className="settings__header">
        <h1>Profil</h1>
      </div>

      <div className="settings__body">
        {/* FOTOĞRAF */}
        <div className="profile__avatar">
          <div className="profile__avatar__image-wrapper">
            <img
              src={profileImage}
              alt="Profil"
              className="profile__avatar__image"
            />
            <div className="profile__avatar__overlay">
              <span>Profil fotoğrafı ekle</span>
              <div className="avatar__actions">
                <button onClick={() => fileInputRef.current?.click()}>
                  🖼️ Fotoğraf yükle
                </button>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                {newFile && (
                  <button disabled={isUpdating} onClick={handleAvatarUpdate}>
                    {isUpdating ? "Yükleniyor..." : "✔️ Kaydet"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AD */}
        <div className="profile__field">
          <label>Ad</label>
          {isEditingName ? (
            <div className="editable__input">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                disabled={isUpdating}
              />
              <div className="input__icons">
                <span className="char-count">{name.length}</span>
                <span className="emoji-icon">😊</span>
                <span className="check-icon" onClick={handleNameUpdate}>
                  ✔️
                </span>
              </div>
            </div>
          ) : (
            <div className="editable__display">
              <span>{name}</span>
              <span
                className="edit-icon"
                onClick={() => setIsEditingName(true)}
              >
                ✏️
              </span>
            </div>
          )}
        </div>

        {/* HAKKIMDA */}
        <div className="profile__field">
          <label>Hakkımda</label>
          {isEditingAbout ? (
            <div className="editable__input">
              <input
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                maxLength={60}
                disabled={isUpdating}
              />
              <div className="input__icons">
                <span className="char-count">{about.length}</span>
                <span className="emoji-icon">😊</span>
                <span className="check-icon" onClick={handleAboutUpdate}>
                  ✔️
                </span>
              </div>
            </div>
          ) : (
            <div className="editable__display">
              <span>{about || "Henüz bir açıklama eklenmedi"}</span>
              <span
                className="edit-icon"
                onClick={() => setIsEditingAbout(true)}
              >
                <i src={"../public/icons/pencil.png"}></i>
              </span>
            </div>
          )}
        </div>

        {/* TELEFON (readonly) */}
        <div className="profile__field">
          <label>Telefon</label>
          <div className="readonly__display">
            <span className="icon">📞</span>
            <span>{user.phone || "Numara eklenmedi"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
