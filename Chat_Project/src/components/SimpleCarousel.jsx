import React, { useState, useEffect } from "react";

const SimpleCarousel = ({
  images = [],
  autoPlay = true,
  interval = 3000,
  animation = "slide", // "slide" | "fade"
}) => {
  const [index, setIndex] = useState(0);

  const next = () => setIndex((prev) => (prev + 1) % images.length);
  const prev = () =>
    setIndex((prev) => (prev - 1 + images.length) % images.length);

  useEffect(() => {
    if (!autoPlay) return;
    const id = setInterval(next, interval);
    return () => clearInterval(id);
  }, [index, autoPlay, interval]);

  const closeLightbox = () => setLightboxOpen(false);

  return (
    <>
      {/* Ana Carousel */}
      <div className="carousel">
        <div className="carousel-viewport">
          <div className="carousel-inner">
            {images.map((src, i) => (
              <div
                key={i}
                className={`carousel-item ${
                  i === index ? "active" : ""
                } ${animation}`}
              >
                <img src={src} alt={`slide-${i}`} className="clickable" />
              </div>
            ))}
          </div>
        </div>

        <button className="nav prev" onClick={prev}>
          ‹
        </button>
        <button className="nav next" onClick={next}>
          ›
        </button>

        <div className="dots">
          {images.map((_, i) => (
            <button
              key={i}
              className={`dot ${i === index ? "active" : ""}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      </div>
    </>
  );
};

export default SimpleCarousel;
