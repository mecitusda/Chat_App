import React, { useState, useRef, useCallback } from "react";
import axios from "axios";
import { useUser } from "../contextAPI/UserContext";

const backgrounds = [
  "bg1.webp",
  "bg2.webp",
  "bg3.webp",
  "bg4.webp",
  "bg5.webp",
  "bg6.webp",
  "bg7.webp",
  "bg8.webp",
  "bg9.webp",
  "bg10.webp",
  "bg11.webp",
  "bg12.webp",
  "bg13.webp",
  "bg14.webp",
  "bg15.webp",
  "bg16.webp",
];

export default function BackgroundSetting({ showNotification }) {
  const { user, setUser } = useUser();
  const currentImageUrl = user?.settings?.chatBgImage || "";
  const currentColor = user?.settings?.chatBgColor || "#000000";
  const [showList, setShowList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);
  const observerRef = useRef();

  const handleSelect = async (bgFilename) => {
    try {
      setLoading(true);
      const fullImageUrl = `/backgrounds/${bgFilename}`;
      const res = await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/settings`,
        {
          userId: user._id,
          chatBgImage: fullImageUrl,
          chatBgColor: null,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        setUser((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            chatBgImage: fullImageUrl,
            chatBgColor: null,
          },
        }));
        setShowList(false);
        showNotification("🔔 Arka plan güncellendi.");
      }
    } catch (err) {
      console.error("Arka plan güncellenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleColorChange = async (e) => {
    const color = e.target.value;
    try {
      setLoading(true);
      const res = await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/settings`,
        {
          userId: user._id,
          chatBgColor: color,
          chatBgImage: null,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        setUser((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            chatBgColor: color,
            chatBgImage: null,
          },
        }));
        setShowList(false);
      }
    } catch (err) {
      console.error("Renk güncellenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const lastThumbRef = useCallback(
    (node) => {
      if (loading) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && visibleCount < backgrounds.length) {
          setVisibleCount((prev) => prev + 5);
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [loading, visibleCount]
  );

  return (
    <div className="bg-setting">
      <h3>Arka Plan Ayarı</h3>

      <div
        className="bg-preview"
        onClick={() => setShowList(true)}
        style={{
          backgroundImage: currentImageUrl ? `url(${currentImageUrl})` : "none",
          backgroundColor: !currentImageUrl ? currentColor : "transparent",
        }}
        title="Arka planı değiştirmek için tıklayın"
      />

      {showList && (
        <div className="bg-overlay">
          <div className="bg-modal">
            <button className="bg-close-btn" onClick={() => setShowList(false)}>
              ×
            </button>
            <h4>Arka Plan Seç</h4>
            <div className="bg-thumb-list">
              {backgrounds.slice(0, visibleCount).map((bg, index) => {
                const isLast = index === visibleCount - 1;
                const thumbPath = `/backgrounds/thumbs/${bg}`;
                return (
                  <img
                    key={bg}
                    ref={isLast ? lastThumbRef : null}
                    src={thumbPath}
                    alt={bg}
                    loading="lazy"
                    className="bg-thumb-img"
                    onClick={() => handleSelect(`${bg.split(".")[0]}.jpg`)}
                  />
                );
              })}
            </div>
            <div className="bg-color-picker">
              <label>🎨 Renk:</label>
              <input
                type="color"
                value={currentColor}
                onChange={handleColorChange}
                disabled={loading}
              />
            </div>
          </div>
        </div>
      )}

      {loading && <p>Güncelleniyor...</p>}
    </div>
  );
}
