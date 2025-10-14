import useScrollAnimation from "../hooks/UseScrollAnimation";

export default function Footer() {
  const [ref, visible] = useScrollAnimation();

  return (
    <footer
      className={`footer scroll-animate ${visible ? "visible" : ""}`}
      ref={ref}
    >
      <div className="footer__content">
        <p>© {new Date().getFullYear()} Scriber. Tüm hakları saklıdır.</p>
      </div>
    </footer>
  );
}
