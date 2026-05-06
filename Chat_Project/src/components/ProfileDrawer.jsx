import React, { useCallback, useMemo, useState } from "react";
import { shallowEqual, useDispatch, useSelector } from "react-redux";
import { addOrUpdateConversations } from "../slices/conversationSlice";
import axios from "axios";
import { useEffect } from "react";
import Avatar from "@mui/material/Avatar";
import { useOutletContext } from "react-router";
import AddMemberModal from "./AddMemberModal";
import formatPhone from "../utils/formatPhone";
import AllMembersModal from "./AllMembersModal";

function classifyType({ msgType, mime, url }) {
  const t = (msgType || "").toLowerCase();
  const m = (mime || "").toLowerCase();
  const ext = extFromUrl(url);

  if (t === "image") return "image";
  if (t === "video") return "video";
  if (t === "audio") return "audio";
  if (t === "file" || t === "document") return "document";
  if (t && t !== "text") return t;

  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m) return "document";

  const imgExt = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg", "avif"];
  const vidExt = ["mp4", "webm", "mov", "m4v", "ogg", "ogv"];
  const audExt = ["mp3", "wav", "ogg", "m4a", "aac", "flac"];
  const docExt = [
    "pdf",
    "doc",
    "docx",
    "ppt",
    "pptx",
    "xls",
    "xlsx",
    "csv",
    "txt",
    "zip",
    "rar",
    "7z",
  ];

  if (imgExt.includes(ext)) return "image";
  if (vidExt.includes(ext)) return "video";
  if (audExt.includes(ext)) return "audio";
  if (docExt.includes(ext)) return "document";
  return "unknown";
}

function extFromUrl(url = "") {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    const m = path.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
    return m ? m[1] : "";
  } catch {
    const m = (url || "").toLowerCase().match(/\.([a-z0-9]+)(?:\?|#|$)/i);
    return m ? m[1] : "";
  }
}

export default function ProfileDrawer({
  onClose,
  meId,
  onOpenLightbox, // (startIndex:number) => void (GLOBAL)
  onBlock,
  onReport,
  onDeleteChat,
  avatar,
  socket,
}) {
  const {
    showNotification,
    activeProfile,
    setActiveProfile,
    setActiveConversation,
  } = useOutletContext();
  const [animateState, setAnimateState] = useState("closed");
  const isGroup = activeProfile?.type === "group";
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [adding, setAdding] = useState(false);
  const fileS = useSelector((s) => s.files?.byKey, shallowEqual);
  const dispatch = useDispatch();
  const convMessages = useSelector(
    (state) =>
      activeProfile?._id
        ? state.messages?.byConversation[activeProfile._id] || []
        : EMPTY_MESSAGES,
    shallowEqual,
  );

  //console.log(conversation);
  const isAdmin = useMemo(() => {
    return isGroup && String(activeProfile?.createdBy?._id) === String(meId);
  }, [isGroup, activeProfile, meId]);

  const [view, setView] = useState("info"); // "info" | "media"
  const [newName, setNewName] = useState(activeProfile?.name || "");

  const [uploading, setUploading] = useState(false); // spinner state

  const peer = useMemo(() => {
    if (isGroup) return null;
    const a = activeProfile?.members?.[0];
    const b = activeProfile?.members?.[1];
    if (!a || !b) return null;
    const mine = String(a?.user?._id) === String(meId) ? a : b;
    const other = mine === a ? b : a;
    return other?.user || null;
  }, [activeProfile, isGroup, meId]);

  const display = useMemo(() => {
    if (isGroup) {
      return {
        name: activeProfile?.name || "Grup",
        phone: "",
        about: activeProfile?.about || "",
      };
    }
    return {
      name: peer?.username || "Kullanıcı",
      phone: peer?.phone || "",
      about: peer?.about || "",
    };
  }, [peer, activeProfile, isGroup]);

  const galleryItems = React.useMemo(() => {
    if (!activeProfile?._id) return [];
    return (convMessages || [])
      .map((m) => {
        if (m.type === "text" || !m._id) return null;

        // fileS store’dan messageId ile media_url al
        const file = fileS?.[activeProfile._id]?.[m._id];
        if (!file?.media_url) return null;

        const mediaType = classifyType({
          msgType: m.type,
          mime: m.mimetype,
          url: file.media_url,
        });

        if (mediaType === "image" || mediaType === "video") {
          return {
            src: file.media_url,
            type: mediaType,
            alt: "media",
            caption: m.text || "",
          };
        }

        return null;
      })
      .filter(Boolean);
  }, [onClose]);

  const mediaThumbs = useMemo(() => {
    return galleryItems
      .filter((i) => i.type === "image" || i.type === "video")
      .slice(0, 9);
  }, [galleryItems]);

  const openBySrc = useCallback(
    (src) => {
      const idx = galleryItems.findIndex((m) => m.src === src);
      onOpenLightbox?.(idx >= 0 ? idx : 0);
    },
    [galleryItems, onOpenLightbox],
  );

  const handleAvatarChange = async (file) => {
    try {
      setUploading(true); // spinner başlat
      // 1) presigned-url al
      const { data } = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/file/presigned-url/group`,
        { params: { fileType: file.type } },
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
          conversationId: activeProfile._id,
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
        },
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

  const handleNameChange = async () => {
    if (!newName) {
      showNotification("❌ Lütfen bir grup adı giriniz.");
      return;
    }
    if (newName === activeProfile?.name) {
      showNotification("❌ Lütfen farklı bir grup adı giriniz.");
      return;
    }
    socket.emit(
      "conversation:update",
      {
        conversationId: activeProfile._id,
        userId: meId,
        name: newName,
      },
      (res) => {
        if (res.success) {
          showNotification("✅ Grup adı başarıyla değiştirildi.");
          dispatch(addOrUpdateConversations([res.conversation]));
          if (res.conversation._id === activeProfile._id) {
            console.log("değişti", res.conversation);
            setActiveProfile(res.conversation);
            setActiveConversation(res.conversation);
          }
        } else {
          showNotification("❌ Grup adı update failed:", res.message);
        }
      },
    );
  };

  const handleAddMembers = () => {
    if (!selectedFriends.length) return;
    setAdding(true);

    socket.emit(
      "conversation:update",
      {
        conversationId: activeProfile._id,
        userId: meId,
        addMembers: selectedFriends,
      },
      (res) => {
        setAdding(false);
        if (res.success) {
          dispatch(addOrUpdateConversations([res.conversation]));
          showNotification("✅ Üyeler başarıyla eklendi.");
          setShowAddModal(false);
          setSelectedFriends([]);
        } else {
          showNotification("❌ Üyeler eklenemedi.");
        }
      },
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
                          disabled={uploading}
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
                      <div className="profile-drawer__name">{display.name}</div>
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
                      Katılımcılar ({activeProfile?.members?.length || 0})
                    </div>

                    <ul className="member_items">
                      {/* ÜYE EKLE KUTUSU */}
                      {isAdmin && (
                        <li
                          className="member-item add-member"
                          onClick={() => setShowAddModal(true)}
                        >
                          <div className="add-member__icon">
                            <i className="fa-solid fa-user-plus"></i>
                          </div>
                          <div className="member-info">
                            <div className="member-name">Üye ekle</div>
                          </div>
                        </li>
                      )}

                      {/* İlk 7 üyeyi göster */}
                      {activeProfile?.members?.slice(0, 7).map((m) => {
                        const u = m?.user || {};
                        const isCreator =
                          String(activeProfile?.createdBy?._id) ===
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
                                  <span className="member-role">Kurucu</span>
                                )}
                              </div>
                              <div className="member-info-row">
                                {u.about && (
                                  <div className="member-about">{u.about}</div>
                                )}
                                {u.phone && (
                                  <div className="member-phone">
                                    {formatPhone(u.phone)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}

                      {/* 👇 7’den fazla varsa “Tümünü Gör” */}
                      {activeProfile?.members?.length > 7 && (
                        <li
                          className="member-item view-all"
                          onClick={() => setView("members")}
                        >
                          <div className="member-info">
                            <div className="member-name">
                              Tümünü Gör ({activeProfile.members.length})
                            </div>
                          </div>
                        </li>
                      )}
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
                {galleryItems.length ? (
                  <div className="profile-drawer__media-grid -lg">
                    {galleryItems.map((m, i) => (
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
        <AddMemberModal
          show={showAddModal}
          onClose={() => setShowAddModal(false)}
          conversation={activeProfile}
          meId={meId}
          socket={socket}
          showNotification={showNotification}
          onAdded={(updatedConv) =>
            dispatch(addOrUpdateConversations([updatedConv]))
          }
        />
        <AllMembersModal
          show={view === "members"}
          onClose={() => setView("info")}
          members={activeProfile?.members || []}
        />
      </aside>
    </div>
  );
}
