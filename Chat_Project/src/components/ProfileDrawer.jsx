import React, { useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { addOrUpdateConversations } from "../slices/conversationSlice";
import axios from "axios";
import { useEffect } from "react";
import Avatar from "@mui/material/Avatar";
import { useOutletContext } from "react-router";
export default function ProfileDrawer({
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
  const { showNotification } = useOutletContext();
  const [animateState, setAnimateState] = useState("closed");
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

  useEffect(() => {
    const t = setTimeout(() => setAnimateState("opening"), 10);
    return () => clearTimeout(t);
  }, []);
  const handleClose = () => {
    setAnimateState("closing"); // önce kayarak kapat
    setTimeout(() => {
      onClose(); // animasyon bitince tamamen kapat
    }, 350); // CSS’teki transition süresiyle eşit olmalı
  };

  // ✅ Grup adı güncelleme handler
  const handleNameChange = async () => {
    if (!newName) {
      showNotification("❌ Lütfen bir grup adı giriniz.");
      return;
    }
    if (newName === conversation?.name) {
      showNotification("❌ Lütfen farklı bir grup adı giriniz.");
      return;
    }
    socket.emit(
      "conversation:update",
      {
        conversationId: conversation._id,
        userId: meId,
        name: newName,
      },
      (res) => {
        if (res.success) {
          showNotification("✅ Grup adı başarıyla değiştirildi.");
          dispatch(addOrUpdateConversations([res.conversation]));
        } else {
          showNotification("❌ Grup adı update failed:", res.message);
        }
      }
    );
  };
  return (
    <div
      className={`profile-drawer  ${
        animateState === "opening"
          ? "is-open"
          : animateState === "closing"
          ? "is-closing"
          : ""
      } ${view === "media" ? "is-media" : ""}`}
    >
      <div className="profile-drawer__overlay" onClick={handleClose} />

      <aside className="profile-drawer__panel" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="profile-drawer__header">
          <button
            className="profile-drawer__close fa-solid fa-xmark"
            onClick={handleClose}
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
                  <div className="about">
                    <div className="profile-drawer__section-title">
                      Hakkında
                    </div>
                    <div className="profile-drawer__about">
                      {display.about || "Henüz bir açıklama yok."}
                    </div>
                  </div>
                )}

                {/* Medya (küçük grid) */}
                <div className="medias">
                  <div className="profile-drawer__section-title">Medya</div>
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
                </div>
                {/* 👥 Grup Katılımcıları */}
                {isGroup && (
                  <div className="profile-drawer__members">
                    <div
                      className="profile-drawer__section-title"
                      style={{ marginTop: 16 }}
                    >
                      Katılımcılar ({conversation?.members?.length || 0})
                    </div>

                    <ul className="member_items">
                      {conversation?.members?.map((m) => {
                        const u = m?.user || {};
                        const isCreator =
                          String(conversation?.createdBy?._id) ===
                          String(u?._id);

                        return (
                          <li key={u._id} className="member-item">
                            <Avatar
                              alt={u.username || "Kullanıcı"}
                              src={
                                u.avatar?.url || "/images/default-avatar.jpg"
                              }
                              sx={{
                                width: 42,
                                height: 42,
                                borderRadius: "50%",
                                flexShrink: 0,
                              }}
                            />
                            <div className="member-info">
                              <div className="member-name-row">
                                <span className="member-name">
                                  {u.username || "Bilinmeyen"}
                                </span>
                                {isCreator && (
                                  <span className="member-role">Yönetici</span>
                                )}
                              </div>

                              {u.phone && (
                                <div className="member-phone">{u.phone}</div>
                              )}

                              {u.about && (
                                <div className="member-about">{u.about}</div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

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
