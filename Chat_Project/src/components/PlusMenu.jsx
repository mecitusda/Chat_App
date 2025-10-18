import React, { useState, useRef, useEffect } from "react";
import { FaFile } from "react-icons/fa";
import { LiaPhotoVideoSolid } from "react-icons/lia";
import { FcCompactCamera } from "react-icons/fc";
import { MdKeyboardVoice } from "react-icons/md";
import { BsPersonFill } from "react-icons/bs";

const PlusMenu = ({ onSelect }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Menü dışında tıklanınca kapat
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
            <FaFile className="plus-icon" /> Belge
          </div>
          <div className="plus-item" onClick={() => handleSelect("media")}>
            <LiaPhotoVideoSolid className="plus-icon" /> Fotoğraf / Video
          </div>
          <div className="plus-item" onClick={() => handleSelect("camera")}>
            <FcCompactCamera className="plus-icon" /> Kamera
          </div>
          <div className="plus-item" onClick={() => handleSelect("audio")}>
            <MdKeyboardVoice className="plus-icon" /> Ses
          </div>
          <div className="plus-item" onClick={() => handleSelect("contact")}>
            <BsPersonFill className="plus-icon" /> Kişi
          </div>
        </div>
      )}
    </div>
  );
};

export default PlusMenu;
