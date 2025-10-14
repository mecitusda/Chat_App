import { useEffect, useState } from "react";
import useScrollAnimation from "../hooks/UseScrollAnimation";

const Header = ({ scrollTarget }) => {
  const [isStickyVisible, setStickyVisible] = useState(false);
  const [ref, visible] = useScrollAnimation();

  useEffect(() => {
    if (!scrollTarget) return;

    const handleScroll = () => {
      const threshold = 150;
      setStickyVisible(scrollTarget.scrollTop > threshold);
    };

    scrollTarget.addEventListener("scroll", handleScroll);
    return () => {
      scrollTarget.removeEventListener("scroll", handleScroll);
    };
  }, [scrollTarget]);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center", // 👈 "start", "center", "end", "nearest"
      });
    }
  };

  return (
    /* __inner kısmı inputla değişicek. */
    <>
      <div className={`header__inner`} id="header">
        <nav className={`main-nav`}>
          <a href="/" className="main-nav__logo">
            <img
              src="../../public/images/logo.png"
              alt="icon"
              className="main-nav__icon"
            />
            <h1>criber</h1>
          </a>
          <ul className="main-nav__items">
            <li>
              <a onClick={() => scrollToSection("gallery")}>Galeri</a>
            </li>
            <li>
              <a onClick={() => scrollToSection("contact")}>İletişim</a>
            </li>
            <li>
              <a href="/login">Giriş Yap</a>
            </li>
          </ul>
        </nav>
        <div
          className={`picture  scroll-animate ${visible ? "visible" : ""}`}
          ref={ref}
        >
          <img id="background" src="../../public/images/header.png" alt="" />
        </div>
      </div>

      <div className={`header__sticky  ${isStickyVisible ? "is-visible" : ""}`}>
        <nav className={`sticky-nav`}>
          <a
            className="sticky-nav__logo"
            onClick={() => scrollToSection("header")}
          >
            <img
              src="../../public/images/logo.png"
              alt="icon"
              className="sticky-nav__icon"
            />
          </a>
          <ul className="sticky-nav__items">
            <li>
              <a onClick={() => scrollToSection("gallery")}>Galeri</a>
            </li>
            <li>
              <a onClick={() => scrollToSection("contact")}>İletişim</a>
            </li>
            <li>
              <a href="/login">Giriş Yap</a>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
};

export default Header;
