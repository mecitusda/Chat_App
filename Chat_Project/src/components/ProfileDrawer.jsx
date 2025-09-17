import React, { useMemo, useState } from "react";

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
}) {
  const isGroup = conversation?.type === "group";
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

  const [view, setView] = useState("info"); // "info" | "media"

  const openBySrc = (src) => {
    const idx = allMedia.findIndex((m) => m.src === src);
    onOpenLightbox?.(idx >= 0 ? idx : 0);
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
                  <img
                    className="profile-drawer__avatar -lg"
                    src={avatar}
                    alt={display.name}
                  />
                  <div className="profile-drawer__name">{display.name}</div>
                  {display.phone && (
                    <div className="profile-drawer__phone">{display.phone}</div>
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
                  {mediaThumbs.map((src, i) => (
                    <button
                      key={`${src}_${i}`}
                      type="button"
                      className="media-item -as-btn"
                      onClick={() => openBySrc(src)} // GLOBAL LIGHTBOX
                      aria-label="Medyayı aç"
                    >
                      <img src={src} alt={`media-${i}`} />
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
                    className="profile-drawer__btn -danger"
                    onClick={onBlock}
                  >
                    <i className="fa-solid fa-ban" />
                    Engelle
                  </button>
                  <button
                    className="profile-drawer__btn -outline"
                    onClick={onReport}
                  >
                    <i className="fa-regular fa-flag" />
                    Şikayet et
                  </button>
                  <button
                    className="profile-drawer__btn -danger"
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
