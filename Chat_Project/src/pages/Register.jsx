import React, { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import axios from "axios";
import { fetchCountryDialCodes } from "../utils/countryCodes";
import { formatPhone10 } from "../utils/phoneFormat";

const Register = () => {
  const { showNotification } = useOutletContext();
  const [countryCodes, setCountryCodes] = useState([]);
  const [form, setForm] = useState({
    username: "",
    email: "",
    countryCode: "+90",
    // phoneNumber inputu ekrana maskeli gösterilecek, state'te sadece digits:
    phoneDigits: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Ülke kodları
  useEffect(() => {
    (async () => {
      try {
        const codes = await fetchCountryDialCodes();
        setCountryCodes(codes);
        const tr = codes.find((c) => c.code === "TR");
        if (tr) {
          setForm((f) => ({ ...f, countryCode: tr.dial_code }));
        }
      } catch {
        // util zaten fallback veriyor
      }
    })();
  }, []);

  const handleBasicChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handlePhoneChange = (e) => {
    // Sadece rakam, 10 haneyle sınırla (TR ulusal: 10)
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    setForm((f) => ({ ...f, phoneDigits: digits }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const usernameRegex = /^[a-zA-Z0-9ğüşöçİıĞÜŞÖÇ\s._-]+$/; // 🔥 boşluk ve Türkçe karakter serbest
    const phoneRegex = /^[0-9]{10}$/;

    // === 1️⃣ Kullanıcı adı ===
    if (!form.username.trim()) {
      showNotification("Kullanıcı adı boş bırakılamaz.");
      return;
    }
    if (form.username.trim().length < 3) {
      showNotification("Kullanıcı adı en az 3 karakter olmalıdır.");
      return;
    }
    if (!usernameRegex.test(form.username.trim())) {
      showNotification(
        "Kullanıcı adı yalnızca harf, rakam, boşluk ve nokta içerebilir."
      );
      return;
    }

    // === 2️⃣ E-posta ===
    if (!form.email.trim()) {
      showNotification("E-posta adresi giriniz.");
      return;
    }
    if (!emailRegex.test(form.email.trim())) {
      showNotification("Geçerli bir e-posta adresi giriniz.");
      return;
    }

    // === 3️⃣ Telefon ===
    if (!form.phoneDigits || !phoneRegex.test(form.phoneDigits)) {
      showNotification(
        "Telefon numarasını 10 hane olarak giriniz. (Örn: 5xx xxx xx xx)"
      );
      return;
    }

    // === 4️⃣ Şifre ===
    if (!form.password) {
      showNotification("Şifre giriniz.");
      return;
    }
    if (form.password.length < 6) {
      showNotification("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (!/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      showNotification("Şifre en az bir büyük harf ve rakam içermelidir.");
      return;
    }

    // 🔥 Artık form geçerli, isteği atabiliriz
    setLoading(true);
    const fullPhone = `${form.countryCode}${form.phoneDigits}`;

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/register`,
        {
          username: form.username.trim(),
          email: form.email.trim(),
          phone: fullPhone,
          password: form.password,
        }
      );

      if (data.success) {
        showNotification("🎉 Başarıyla kayıt olundu!");
        navigate("/verify-email", {
          state: { email: form.email },
          replace: true,
        });
      } else {
        showNotification(data.message || "Kayıt başarısız.");
      }
    } catch (err) {
      console.error("Register error:", err);
      showNotification(err?.response?.data?.message || "Sunucu hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={`header__inner`} id="header">
        <nav className={`main-nav`}>
          <a href="/" className="main-nav__logo">
            <img src="/images/logo.png" alt="icon" className="main-nav__icon" />
            <h1>criber</h1>
          </a>
        </nav>
      </div>
      <div className="auth-container">
        <h2>Kayıt Ol</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            type="text"
            name="username"
            placeholder="Kullanıcı adı"
            onChange={handleBasicChange}
            value={form.username}
            required
          />
          <input
            type="email"
            name="email"
            placeholder="E-posta"
            onChange={handleBasicChange}
            value={form.email}
            required
          />

          {/* Ülke kodu + maskeli telefon */}
          <div className="phone-input">
            <select
              name="countryCode"
              value={form.countryCode}
              onChange={handleBasicChange}
            >
              {countryCodes.map((c) => (
                <option key={c.code} value={c.dial_code}>
                  {c.name} ({c.dial_code})
                </option>
              ))}
            </select>

            <input
              type="tel"
              name="phoneMasked"
              inputMode="numeric"
              placeholder="(5xx) xxx xx xx"
              value={formatPhone10(form.phoneDigits)}
              onChange={handlePhoneChange}
              aria-label="Telefon numarası"
              required
            />
          </div>

          <input
            type="password"
            name="password"
            placeholder="Şifre"
            onChange={handleBasicChange}
            value={form.password}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Kaydediliyor..." : "Kayıt Ol"}
          </button>
        </form>

        {/* Link ile garanti gezinme */}
        <p className="auth-switch">
          <span>
            Hesabınız var mı? <Link to="/login">Giriş yapın!</Link>
          </span>
        </p>
      </div>
    </>
  );
};

export default Register;
