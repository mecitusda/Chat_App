// pages/Home.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import HeroSection from "../components/HeroSection";
import ContactSection from "../components/ContactSection";
import Footer from "../components/Footer";
import Faq from "../components/Faq";
import GallerySection from "../components/GallerySection";

export default function Home() {
  const navigate = useNavigate();
  const [scrollTarget, setScrollTarget] = useState(null);

  useEffect(() => {
    document.body.className = "body-home";
    document.documentElement.className = "html-home";
    const root = document.getElementById("root");
    if (root) root.classList.add("root-home");

    // Scrollable hedefi ayarla
    const scrollable = document.querySelector(".root-home");
    setScrollTarget(scrollable);

    return () => {
      document.body.className = "";
      document.documentElement.className = "";
      if (root) root.classList.remove("root-home");
    };
  }, []);
  return (
    <>
      {scrollTarget && <Header scrollTarget={scrollTarget} />}
      <div className="home" id="home">
        {/* Hero */}
        <HeroSection />

        {/* Gallery */}
        <GallerySection />

        {/* Contact */}
        <ContactSection />

        {/* Faq */}
        <Faq />

        {/* Footer */}
        <Footer />
      </div>
    </>
  );
}
