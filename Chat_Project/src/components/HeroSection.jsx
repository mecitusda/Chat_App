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
              <img src="/images/inner_logo.png" alt="" />
              <span id="logo">criber</span>
            </span>{" "}
            <span id="text_logo">ile Tanışın</span>
          </h1>
        </div>
        <p className="hero-subtext">
          <strong>Scriber</strong>, gerçek zamanlı iletişimi güvenle
          deneyimlemeniz için geliştirilen yeni nesil bir mesajlaşma
          platformudur. Her tıklamada hız, her mesajda gizlilik ve her
          etkileşimde sadelik önceliğimizdir. Bugün yalnızca bir{" "}
          <strong> demo</strong>, yarın iletişimin yeni standardı. Soru ve
          önerilerinizi buradan{" "}
          <span className="link" onClick={() => scrollToSection("contact")}>
            paylaşabilirsiniz.
          </span>
        </p>
      </div>
    </section>
  );
}
