// pages/Home.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

const updates = [
  { date: "2025-09-24", version: "v1.2.0", text: "Grup sohbetleri eklendi 🎉" },
  {
    date: "2025-09-20",
    version: "v1.1.0",
    text: "Arkadaş sistemi tamamlandı 🤝",
  },
  { date: "2025-09-15", version: "v1.0.0", text: "Chat uygulaması yayında 🚀" },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="home">
      {/* Hero */}
      <header className="hero">
        <h1>🚀 ChatApp</h1>
        <p>Gerçek zamanlı, hızlı ve güvenli sohbet deneyimi.</p>
        <div className="hero-actions">
          <button onClick={() => navigate("/login")}>Giriş Yap</button>
          <button onClick={() => navigate("/register")}>Kayıt Ol</button>
        </div>
      </header>

      {/* Updates Console */}
      <section className="updates">
        <h2>📜 Güncellemeler</h2>
        <div className="console">
          {updates.map((u, i) => (
            <div key={i} className="console-line">
              <span className="console-date">[{u.date}]</span>{" "}
              <span className="console-version">{u.version}</span> - {u.text}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <h2>✨ Özellikler</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <i className="fa-solid fa-lock"></i>
            <h3>Güvenli</h3>
            <p>Uçtan uca şifreleme ve güvenli bağlantı.</p>
          </div>
          <div className="feature-card">
            <i className="fa-solid fa-users"></i>
            <h3>Gruplar</h3>
            <p>Arkadaşlarınla kolayca grup sohbetleri kur.</p>
          </div>
          <div className="feature-card">
            <i className="fa-solid fa-bolt"></i>
            <h3>Hızlı</h3>
            <p>Gerçek zamanlı mesajlaşma deneyimi.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>© 2025 ChatApp. Tüm hakları saklıdır.</p>
      </footer>
    </div>
  );
}
