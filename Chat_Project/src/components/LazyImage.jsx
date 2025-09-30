import { useState } from "react";

export default function LazyImage({
  thumbSrc,
  fullSrc,
  alt,
  onClick,
  observe,
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="lazy-image-wrapper" onClick={onClick} ref={observe}>
      <img
        src={thumbSrc}
        alt={alt}
        className="lazy-image thumb"
        loading="lazy"
      />
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
