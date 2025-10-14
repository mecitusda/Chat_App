import useScrollAnimation from "../hooks/UseScrollAnimation";
const scrollToSection = (id) => {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center", // 👈 "start", "center", "end", "nearest"
    });
  }
  console.log("ckick");
};
export default function HeroSection() {
  const [ref, visible] = useScrollAnimation();

  return (
    <section
      className={`hero scroll-animate ${visible ? "visible" : ""}`}
      ref={ref}
      id="hero"
    >
      <div className="hero__inner mb-2">
        <div className="hero-title">
          <h1>
            <span>
              <img src="/images/logo.png" alt="" />
              <span id="logo">criber</span>
            </span>{" "}
            <span>ile Tanışın</span>
          </h1>
        </div>
        <p className="hero-subtext">
          <strong>Scriber</strong>, gerçek zamanlı, güvenli ve hızlı mesajlaşma
          deneyimi sunmak için
          <strong> demo</strong> olarak yayınlanmıştır.
        </p>
        <p className="hero-subtext">
          Geri bildirimlerinizle gelişmeye devam ediyoruz. Sorun, öneri ya da
          görüşlerinizi bizimle{" "}
          <span className="link" onClick={() => scrollToSection("contact")}>
            paylaşabilirsiniz.
          </span>
        </p>
      </div>
    </section>
  );
}
