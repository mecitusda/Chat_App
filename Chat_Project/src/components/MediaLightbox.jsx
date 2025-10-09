// components/MediaLightbox.jsx
import React, { useEffect, useCallback, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { FiDownload, FiX } from "react-icons/fi";
import { MdOutlineNavigateNext, MdOutlineNavigateBefore } from "react-icons/md";
export default function MediaLightbox({
  items,
  index,
  onClose,
  onPrev,
  onNext,
}) {
  const item = items[index];
  const railRef = useRef(null);

  // Zoom/Pan sadece IMAGE için
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isZoomed = zoom > 1;
  const isImage = item?.type === "image";
  const isVideo = item?.type === "video";

  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startOffX: 0,
    startOffY: 0,
  });

  const onKey = useCallback(
    (e) => {
      if (e.key === "Escape") onClose();
      if (!isZoomed) {
        if (e.key === "ArrowLeft") onPrev();
        if (e.key === "ArrowRight") onNext();
      }
    },
    [onClose, onPrev, onNext, isZoomed]
  );

  useEffect(() => {
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onKey]);

  const centerActiveThumb = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const active = rail.querySelector(`[data-idx="${index}"]`);
    if (!active) return;
    const railRect = rail.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const newScrollLeft =
      rail.scrollLeft +
      (activeRect.left - railRect.left) -
      (railRect.width / 2 - activeRect.width / 2);
    rail.scrollTo({ left: newScrollLeft, behavior: "smooth" });
  }, [index]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const needsCenter = rail.scrollWidth <= rail.clientWidth + 1;
    rail.classList.toggle("is-centered", needsCenter);
    centerActiveThumb();
  }, [items, index, centerActiveThumb]);

  // görsel/video değişince zoom/pan resetle
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setOrigin({ x: 50, y: 50 });
  }, [index]);

  // ---- IMAGE zoom helpers ----
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const handleWheel = (e) => {
    if (!isImage) return; // video için zoom yok
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 0.1 : -0.1;
    const nextZoom = clamp(zoom + factor, 1, 3);

    const stage = e.currentTarget;
    const rect = stage.getBoundingClientRect();
    const ox = ((e.clientX - rect.left) / rect.width) * 100;
    const oy = ((e.clientY - rect.top) / rect.height) * 100;

    setOrigin({ x: ox, y: oy });
    setZoom(nextZoom);
    if (nextZoom === 1) setOffset({ x: 0, y: 0 });
  };

  const handleToggleZoomClick = (e) => {
    if (!isImage) return; // video için tık zoom yok
    if (zoom === 1) {
      const rect = e.currentTarget.getBoundingClientRect();
      const ox = ((e.clientX - rect.left) / rect.width) * 100;
      const oy = ((e.clientY - rect.top) / rect.height) * 100;
      setOrigin({ x: ox, y: oy });
      setZoom(2);
    } else {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setOrigin({ x: 50, y: 50 });
    }
  };

  const onDragStart = (e) => {
    if (!isImage || zoom === 1) return;
    dragRef.current = {
      active: true,
      startX: "touches" in e ? e.touches[0].clientX : e.clientX,
      startY: "touches" in e ? e.touches[0].clientY : e.clientY,
      startOffX: offset.x,
      startOffY: offset.y,
    };
  };
  const onDragMove = (e) => {
    const d = dragRef.current;
    if (!d.active) return;
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
    const dx = cx - d.startX;
    const dy = cy - d.startY;
    setOffset({ x: d.startOffX + dx, y: d.startOffY + dy });
  };
  const onDragEnd = () => {
    dragRef.current.active = false;
  };

  if (!item) return null;

  return ReactDOM.createPortal(
    <div className="lightbox" role="dialog" aria-modal="true">
      <div className="lightbox__backdrop" onClick={onClose} />

      <div className="lightbox__content" onClick={(e) => e.stopPropagation()}>
        {/* Üst bar */}
        <div className="lightbox__topbar">
          <div className="lightbox__counter">
            {index + 1} / {items.length}
          </div>
          <div className="lightbox__actions">
            <a
              href={item.src}
              download
              className="lightbox__btn"
              title="İndir"
              target="_blank"
            >
              <FiDownload size={18} />
            </a>
            <button className="lightbox__btn" onClick={onClose} title="Kapat">
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* İçerik alanı (image/video) */}
        <div
          className={`lightbox__stage ${
            isImage && isZoomed ? "is-zoomed" : ""
          }`}
          onWheel={handleWheel}
          onClick={handleToggleZoomClick}
          onMouseDown={onDragStart}
          onMouseMove={onDragMove}
          onMouseUp={onDragEnd}
          onMouseLeave={onDragEnd}
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
        >
          {isImage ? (
            <img
              src={item.src}
              alt={item.alt || "media"}
              loading="eager"
              style={{
                transformOrigin: `${origin.x}% ${origin.y}%`,
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                cursor: isZoomed ? "grab" : "zoom-in",
                userSelect: "none",
              }}
              draggable={false}
            />
          ) : (
            <video
              src={item.src}
              controls
              autoPlay={false}
              style={{
                maxWidth: "92vw",
                maxHeight: "72vh",
                borderRadius: "12px",
                display: "block",
                background: "#000",
              }}
            />
          )}

          {item.caption && (
            <div className="lightbox__caption">{item.caption}</div>
          )}
        </div>

        {/* Navigasyon */}
        {items.length > 1 && (
          <>
            <button
              className="lightbox__nav lightbox__nav--prev"
              onClick={onPrev}
              aria-label="Önceki"
            >
              <MdOutlineNavigateBefore />
            </button>
            <button
              className="lightbox__nav lightbox__nav--next"
              onClick={onNext}
              aria-label="Sonraki"
            >
              <MdOutlineNavigateNext />
            </button>
          </>
        )}

        {/* Thumbnail rail */}
        {items.length > 1 && (
          <div className="lightbox__rail-wrap">
            <div
              className="lightbox__rail"
              ref={railRef}
              onWheel={(e) => {
                e.currentTarget.scrollLeft += e.deltaY || e.deltaX;
              }}
            >
              {items.map((it, i) => (
                <button
                  key={i}
                  data-idx={i}
                  className={`lightbox__thumb ${
                    i === index ? "is-active" : ""
                  }`}
                  onClick={() => {
                    const steps = Math.abs(i - index);
                    const dir = i > index ? onNext : onPrev;
                    for (let s = 0; s < steps; s++) dir();
                  }}
                  title={it.caption || `Medya ${i + 1}`}
                >
                  {it.type === "image" ? (
                    <img
                      className="thumb-img"
                      src={it.src}
                      alt={it.alt || `thumb-${i}`}
                      loading="lazy"
                    />
                  ) : (
                    <span className="thumb-video">
                      {it.poster ? (
                        <img
                          className="thumb-img"
                          src={it.poster}
                          alt={it.alt || `thumb-${i}`}
                          loading="lazy"
                        />
                      ) : (
                        <video
                          className="thumb-video__el"
                          src={it.src}
                          muted
                          preload="metadata"
                          playsInline
                        />
                      )}
                      <span className="thumb-video__badge">▶︎</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
