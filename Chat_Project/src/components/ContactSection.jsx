import { useState } from "react";
import useScrollAnimation from "../hooks/UseScrollAnimation";
import { useOutletContext } from "react-router";
import axios from "axios";
export default function ContactSection() {
  const { showNotification } = useOutletContext();
  const [ref, visible] = useScrollAnimation();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/contact`,
        formData,
      );

      if (data.success) {
        showNotification(
          "✅ Mesajınız alınmıştır. En kısa sürede dönüş yapılacaktır.",
        );
        setFormData({ name: "", email: "", phone: "", message: "" });
      } else {
        showNotification("⚠️ " + (data.message || "Bilinmeyen hata"));
      }
    } catch (err) {
      console.error(err);

      // 🔥 Özel limit kontrolü
      if (err.response?.status === 429) {
        showNotification(
          "🚫 Günlük mesaj limitine ulaştınız. Lütfen yarın tekrar deneyin.",
        );
      } else if (err.response?.data?.message) {
        showNotification("⚠️ " + err.response.data.message);
      } else {
        showNotification("❌ Sunucu hatası. Lütfen daha sonra tekrar deneyin.");
      }
    }
  };

  return (
    <section className="contact mb-2">
      <div
        className={`contact__inner scroll-animate ${visible ? "visible" : ""}`}
        ref={ref}
        id="contact"
      >
        <h2>📩 Bize Ulaşın</h2>
        <p className="contact-intro">
          Sorun, öneri ya da iş birliği fikirlerinizi bizle paylaşabilirsiniz.
          Aşağıdaki formu doldurun, sizinle iletişime geçelim.
        </p>
        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Adınız</label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="Adınız"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">E‑posta</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="E‑posta adresiniz"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="phone">Telefon</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                placeholder="Telefon numaranız"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="message">Mesajınız</label>
            <textarea
              id="message"
              name="message"
              placeholder="Mesajınızı buraya yazın..."
              value={formData.message}
              onChange={handleChange}
              rows={5}
              required
            />
          </div>

          <button type="submit" className="submit-btn">
            Gönder
          </button>
        </form>
      </div>
    </section>
  );
}
