import React, { useState, useRef, useCallback } from "react";
import axios from "axios";
import { useUser } from "../contextAPI/UserContext";
import { MdClose } from "react-icons/md";
import LazyImage from "./LazyImage";

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

  // ✅ geçici seçimler (önizleme)
  const [tempBg, setTempBg] = useState(currentImageUrl);
  const [tempColor, setTempColor] = useState(currentColor);

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

  // ✅ sadece seçimi değiştir (henüz kaydetme)
  const handleSelectImage = (bgFilename) => {
    const fullImageUrl = `/backgrounds/${bgFilename}`;
    setTempBg(fullImageUrl);
    setTempColor(null);
  };

  const handleColorChange = (e) => {
    const color = e.target.value;
    setTempColor(color);
    setTempBg(null);
  };

  // ✅ kaydet (tek endpoint)
  const handleApply = async () => {
    try {
      setLoading(true);
      const res = await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/api/user/settings`,
        {
          userId: user._id,
          chatBgImage: tempBg,
          chatBgColor: tempBg ? null : tempColor,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        setUser((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            chatBgImage: tempBg,
            chatBgColor: tempBg ? null : tempColor,
          },
        }));
        showNotification("🎨 Arka plan güncellendi.");
        setShowList(false);
      }
    } catch (err) {
      console.error("Arka plan kaydedilemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-setting">
      <h3>Arka Plan Ayarı</h3>

      {/* ✅ önizleme */}
      <div
        className="bg-preview"
        onClick={() => setShowList(true)}
        style={{
          backgroundImage: tempBg ? `url(${tempBg})` : "none",
          backgroundColor: !tempBg ? tempColor : "transparent",
        }}
        title="Arka planı değiştirmek için tıklayın"
      />

      {/* ✅ modal */}
      {showList && (
        <div className="bg-overlay">
          <div className="bg-modal">
            <MdClose
              className="bg-close-btn"
              onClick={() => {
                setShowList(false);
                setTempBg(currentImageUrl);
                setTempColor(currentColor);
              }}
            />
            <h4>Arka Plan Seç</h4>

            <div className="bg-thumb-list">
              {backgrounds.slice(0, visibleCount).map((bg, index) => {
                const isLast = index === visibleCount - 1;
                const thumbPath = `/backgrounds/thumbs/${bg}`;
                const fullPath = `/backgrounds/${bg}`;
                const isSelected = tempBg === fullPath; // ✅ seçili kontrolü
                return (
                  <LazyImage
                    key={bg}
                    thumbSrc={thumbPath}
                    fullSrc={fullPath}
                    alt={bg}
                    onClick={() => handleSelectImage(bg)}
                    observe={isLast ? lastThumbRef : null}
                    className={`bg-thumb-img ${isSelected ? "selected" : ""}`}
                  />
                );
              })}
            </div>

            <div className="bg-color-picker">
              <label>🎨 Renk:</label>
              <input
                type="color"
                value={tempColor || "#000000"}
                onChange={handleColorChange}
                disabled={loading}
              />
            </div>

            <button
              onClick={handleApply}
              disabled={loading}
              className="bg-apply-btn"
            >
              {loading ? "Kaydediliyor..." : "Uygula"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
