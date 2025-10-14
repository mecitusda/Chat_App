import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import BackgroundSetting from "./BackgroundSetting";
import { useUser } from "../contextAPI/UserContext";

export default function ProfileSettings({ socket, showNotification }) {
  const fileInputRef = useRef(null);
  const { user, setUser } = useUser();
  const [profileImage, setProfileImage] = useState(
    user.avatar?.url || "/images/default-avatar.jpg"
  );
  if (!user) {
    return <div>Profil yükleniyor...</div>;
  }
  const [newFile, setNewFile] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const [name, setName] = useState(user.username || "");
  const [about, setAbout] = useState(user.about || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingAbout, setIsEditingAbout] = useState(false);

  async function fetchUserAvatar() {
    const now = Date.now();
    if (
      (user.avatar && !user.avatar?.url_expiresAt) ||
      new Date(user.avatar?.url_expiresAt) <= now
    ) {
      const { data } = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/user/${user?._id}`
      );
      setUser((prev) => ({
        ...prev,
        avatar: data.avatar, // { key, url, url_expiresAt }
      }));
    }
  }
  fetchUserAvatar();
  useEffect(() => {
    setProfileImage(user.avatar?.url || "/images/default-avatar.jpg");
  }, [user.avatar]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewFile(file);
    setProfileImage(URL.createObjectURL(file));
  };

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

      // 3) backend'e avatar kaydet (sadece key)
      const patchResp = await axios.patch(
        `${import.meta.env.VITE_BACKEND_URL}/api/user/profile`,
        {
          user_id: user._id,
          avatar: media_key, // backend avatar.key olarak kaydedecek
        }
      );

      if (patchResp.data.success) {
        setUser((prev) => ({
          ...prev,
          avatar: {
            url: patchResp.data.user.avatar.url,
            url_expiresAt: patchResp.data.user.avatar.url_expiresAt,
          }, // { key, url, url_expiresAt }
        }));

        setProfileImage(patchResp.data.user.avatar.url);
        setNewFile(null);
        showNotification("🔔Profil fotoğrafı güncellendi.");
      }
    } catch (err) {
      console.error("Avatar güncelleme hatası:", err);
      alert("Avatar güncellenemedi");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNameUpdate = async () => {
    try {
      setIsUpdating(true);
      const resp = await axios.patch(
        `${import.meta.env.VITE_BACKEND_URL}/api/user/profile`,
        { user_id: user._id, username: name }
      );
      if (resp.data.success && resp.data.user) {
        setUser(resp.data.user);
        setIsEditingName(false);
        showNotification("🔔Kullanıcı adı güncellendi.");
      }
    } catch (err) {
      console.error("İsim güncellenemedi:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAboutUpdate = async () => {
    try {
      setIsUpdating(true);
      const resp = await axios.patch(
        `${import.meta.env.VITE_BACKEND_URL}/api/user/profile`,
        { user_id: user._id, about }
      );
      if (resp.data.success && resp.data.user) {
        setUser((prev) => ({
          ...prev,
          about: resp.data.user.about,
        }));
        setIsEditingAbout(false);
        showNotification("🔔Hakkında alanı güncellendi.");
      }
    } catch (err) {
      console.error("Hakkımda güncellenemedi:", err);
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
                className="edit-icon fa-solid fa-pen-to-square"
                onClick={() => setIsEditingName(true)}
              ></span>
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
                className="edit-icon fa-solid fa-pen-to-square"
                onClick={() => setIsEditingAbout(true)}
              ></span>
            </div>
          )}
        </div>

        {/* TELEFON */}
        <div className="profile__field">
          <label>Telefon</label>
          <div className="readonly__display">
            <span className="icon">📞</span>
            <span>{user.phone || "Numara eklenmedi"}</span>
          </div>
        </div>

        {/* ARKA PLAN SEÇİMİ */}
        <BackgroundSetting showNotification={showNotification} />
      </div>
    </div>
  );
}
