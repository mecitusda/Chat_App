import { useState } from "react";

export default function LazyImage({
  thumbSrc,
  fullSrc,
  alt,
  onClick,
  observe,
  className = "",
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`lazy-image-wrapper ${className}`} ref={observe}>
      <img
        src={thumbSrc}
        alt={alt}
        className="lazy-image thumb"
        loading="lazy"
      />

      {!loaded && (
        <div className="lazy-image-spinner">
          <div className="spinner" />
        </div>
      )}

      <img
        src={fullSrc}
        alt={alt}
        className={`lazy-image full ${loaded ? "loaded" : ""}`}
        onLoad={() => setLoaded(true)}
        loading="lazy"
      />
    </div>
  );
}
