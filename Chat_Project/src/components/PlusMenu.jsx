import React, { useState, useRef, useEffect } from "react";

const PlusMenu = ({ onSelect }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Menü dışında bir yere tıklanınca kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (type) => {
    setOpen(false);
    onSelect?.(type); // seçilen itemi dışarı ver
  };

  return (
    <div className="plus-menu" ref={menuRef}>
      <button className="plus-btn" onClick={() => setOpen(!open)}>
        +
      </button>

      {open && (
        <div className="plus-dropdown">
          <div className="plus-item" onClick={() => handleSelect("document")}>
            📄 Belge
          </div>
          <div className="plus-item" onClick={() => handleSelect("media")}>
            🖼 Fotoğraf / Video
          </div>
          <div className="plus-item" onClick={() => handleSelect("camera")}>
            📷 Kamera
          </div>
          <div className="plus-item" onClick={() => handleSelect("audio")}>
            🎤 Ses
          </div>
          <div className="plus-item" onClick={() => handleSelect("contact")}>
            👤 Kişi
          </div>
          <div className="plus-item" onClick={() => handleSelect("poll")}>
            📊 Anket
          </div>
          <div className="plus-item" onClick={() => handleSelect("sticker")}>
            ✨ Yeni Çıkartma
          </div>
          <div className="plus-item" onClick={() => handleSelect("event")}>
            📅 Etkinlik
          </div>
        </div>
      )}
    </div>
  );
};

export default PlusMenu;
