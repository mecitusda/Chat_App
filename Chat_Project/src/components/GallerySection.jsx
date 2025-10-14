import { Carousel } from "flowbite-react";
import useScrollAnimation from "../hooks/UseScrollAnimation";
import SimpleCarousel from "./SimpleCarousel";

const galleryImages = [
  "/images/promotion1.png",
  "/images/promotion2.png",
  "/images/promotion3.png",
];

export default function GallerySection() {
  const [ref, visible] = useScrollAnimation();

  return (
    <section
      className={`gallery mb-2 scroll-animate ${visible ? "visible" : ""}`}
      ref={ref}
      id="gallery"
    >
      <div className="gallery__inner">
        <SimpleCarousel
          images={galleryImages}
          loop={true}
          autoPlay={true}
          interval={3500}
          animation="fade"
        />
      </div>
    </section>
  );
}
