import React, { useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { addOrUpdateConversations } from "../slices/conversationSlice";
import axios from "axios";
export default function ProfileDrawer({
  isOpen,
  onClose,
  conversation,
  meId,
  mediaThumbs = [], // küçük grid için src[]
  allMedia = [], // [{src, type?, alt?}]
  onOpenLightbox, // (startIndex:number) => void (GLOBAL)
  onBlock,
  onReport,
  onDeleteChat,
  avatar,
  socket,
}) {
  const isGroup = conversation?.type === "group";
  const dispatch = useDispatch();
  const isAdmin = useMemo(() => {
    return isGroup && String(conversation?.createdBy?._id) === String(meId);
  }, [isGroup, conversation, meId]);

  const [view, setView] = useState("info"); // "info" | "media"
  const [newName, setNewName] = useState(conversation?.name || "");
  const [uploading, setUploading] = useState(false); // ✅ spinner state

  const peer = useMemo(() => {
    if (isGroup) return null;
    const a = conversation?.members?.[0];
    const b = conversation?.members?.[1];
    if (!a || !b) return null;
    const mine = String(a?.user?._id) === String(meId) ? a : b;
    const other = mine === a ? b : a;
    return other?.user || null;
  }, [conversation, isGroup, meId]);

  const display = useMemo(() => {
    if (isGroup) {
      return {
        name: conversation?.name || "Grup",
        phone: "",
        about: conversation?.about || "",
      };
    }
    return {
      name: peer?.username || "Kullanıcı",
      phone: peer?.phone || "",
      about: peer?.about || "",
    };
  }, [peer, conversation, isGroup]);

  const openBySrc = (src) => {
    const idx = allMedia.findIndex((m) => m.src === src);
    onOpenLightbox?.(idx >= 0 ? idx : 0);
  };

  const handleAvatarChange = async (file) => {
    try {
      setUploading(true); // spinner başlat
      // 1) presigned-url al
      const { data } = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/file/presigned-url/group`,
        { params: { fileType: file.type } }
      );

      const { uploadUrl, key } = data;

      // 2) PUT ile dosyayı S3'e yükle
      await axios.put(uploadUrl, file, {
        headers: { "Content-Type": file.type },
      });

      // 3) socket ile güncelleme iste
      socket.emit(
        "conversation:update",
        {
          conversationId: conversation._id,
          userId: meId,
          avatarKey: key,
        },
        (res) => {
          if (res.success) {
            dispatch(addOrUpdateConversations([res.conversation]));
          } else {
            console.error("❌ Avatar update failed:", res.message);
          }
          setUploading(false);
        }
      );
    } catch (err) {
      setUploading(false);
      console.error("Avatar yükleme hatası:", err.message);
    }
  };

  // ✅ Grup adı güncelleme handler
  const handleNameChange = async () => {
    if (!newName || newName === conversation?.name) return;
    socket.emit(
      "conversation:update",
      {
        conversationId: conversation._id,
        userId: meId,
        name: newName,
      },
      (res) => {
        if (res.success) {
          dispatch(addOrUpdateConversations([res.conversation]));
        } else {
          console.error("❌ Grup adı update failed:", res.message);
        }
      }
    );
  };
  return (
    <div
      className={`profile-drawer ${isOpen ? "is-open" : ""} ${
        view === "media" ? "is-media" : ""
      }`}
    >
      <div className="profile-drawer__overlay" onClick={onClose} />

      <aside className="profile-drawer__panel" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="profile-drawer__header">
          <button
            className="profile-drawer__close fa-solid fa-xmark"
            onClick={onClose}
            aria-label="Kapat"
          />
          <div className="profile-drawer__title">Profil</div>
        </div>

        {/* Views */}
        <div className="profile-drawer__views">
          <div className="profile-drawer__slider">
            {/* ========== INFO ========== */}
            <section className="profile-drawer__view">
              <div className="profile-drawer__body">
                {/* HERO: Ortalanmış büyük avatar + ad + telefon */}
                <div className="profile-drawer__hero">
                  {isGroup && isAdmin ? (
                    <>
                      {/* Grup avatarını değiştirme */}
                      <label className="avatar-upload">
                        <img
                          className="profile-drawer__avatar"
                          src={avatar}
                          alt={newName}
                        />
                        {uploading && (
                          <div className="avatar-overlay">
                            <i className="fa-solid fa-spinner fa-spin"></i>
                          </div>
                        )}
                        {!uploading && (
                          <div className="avatar-camera">
                            <i className="fa-solid fa-camera"></i>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          disabled={uploading} // ✅ yüklenirken tıklama kapalı
                          onChange={(e) =>
                            e.target.files?.[0] &&
                            handleAvatarChange(e.target.files[0])
                          }
                        />
                      </label>

                      {/* Grup adını değiştirme */}
                      <input
                        type="text"
                        className="profile-drawer__name-edit"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onBlur={handleNameChange} // blur’da kaydet
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleNameChange()
                        }
                      />
                    </>
                  ) : (
                    <>
                      <img
                        className="profile-drawer__avatar -lg"
                        src={avatar}
                        alt={newName}
                      />
                      <div className="profile-drawer__name">{newName}</div>
                      {display.phone && (
                        <div className="profile-drawer__phone">
                          {display.phone}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Hakkında */}
                {(display.about || !isGroup) && (
                  <>
                    <div className="profile-drawer__section-title">
                      Hakkında
                    </div>
                    <div className="profile-drawer__about">
                      {display.about || "Henüz bir açıklama yok."}
                    </div>
                  </>
                )}

                {/* Medya (küçük grid) */}
                <div
                  className="profile-drawer__section-title"
                  style={{ marginTop: 16 }}
                >
                  Medya
                </div>
                <div className="profile-drawer__media-grid">
                  {mediaThumbs.map((m, i) => (
                    <button
                      key={`${m.src}_${i}`}
                      type="button"
                      className="media-item -as-btn"
                      onClick={() => openBySrc(m.src)} // GLOBAL LIGHTBOX
                      aria-label="Medyayı aç"
                    >
                      {m.type === "video" ? (
                        <video src={m.src} muted playsInline />
                      ) : (
                        <img src={m.src} alt={`media-${i}`} />
                      )}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="profile-drawer__btn -ghost"
                    style={{ gridColumn: "1 / -1", marginTop: 4 }}
                    onClick={() => setView("media")}
                  >
                    <i className="fa-regular fa-images" />
                    Tüm medyayı gör
                  </button>
                </div>

                {/* ENGELLE / ŞİKAYET / SİL — ALT ALTA */}
                <div className="profile-drawer__stack">
                  <button
                    className="profile-drawer__btn -danger disabled-tip"
                    onClick={onBlock}
                  >
                    <i className="fa-solid fa-ban" />
                    Engelle
                  </button>
                  <button
                    className="profile-drawer__btn -outline  disabled-tip"
                    onClick={onReport}
                  >
                    <i className="fa-regular fa-flag" />
                    Şikayet et
                  </button>
                  <button
                    className="profile-drawer__btn -danger disabled-tip"
                    onClick={onDeleteChat}
                  >
                    <i className="fa-solid fa-trash-can" />
                    Sohbeti sil
                  </button>
                </div>
              </div>
            </section>

            {/* ========== MEDIA (tüm medya) ========== */}
            <section className="profile-drawer__media">
              <div className="profile-drawer__media-header">
                <button
                  className="profile-drawer__back fa-solid fa-arrow-left"
                  onClick={() => setView("info")}
                  aria-label="Geri"
                />
                <div className="profile-drawer__title">Medya</div>
                <span />
              </div>

              <div className="profile-drawer__media-body">
                {allMedia.length ? (
                  <div className="profile-drawer__media-grid -lg">
                    {allMedia.map((m, i) => (
                      <button
                        key={`${m.src}_${i}`}
                        type="button"
                        className="media-item -as-btn"
                        onClick={() => onOpenLightbox?.(i)} // GLOBAL LIGHTBOX
                      >
                        {m.type === "video" ? (
                          <video src={m.src} muted playsInline />
                        ) : (
                          <img src={m.src} alt={m.alt || `media-${i}`} />
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="profile-drawer__empty">Medya bulunamadı.</div>
                )}
              </div>
            </section>
          </div>
        </div>
      </aside>
    </div>
  );
}
