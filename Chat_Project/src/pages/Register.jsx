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
    if (form.phoneDigits.length !== 10) {
      alert("Telefon numarasını 10 hane olarak giriniz. (Örn: 5xx xxx xx xx)");
      return;
    }
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
        showNotification("🔔Başarıyla kayıt olundu.");
        navigate("/verify-email", {
          state: { email: form.email },
          replace: true,
        });
      } else {
        alert(data.message || "Kayıt başarısız");
      }
    } catch (err) {
      console.error("Register error:", err);
      alert(err?.response?.data?.message || "Sunucu hatası");
    } finally {
      setLoading(false);
    }
  };

  return (
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
        Hesabın var mı? <Link to="/login">Giriş yap</Link>
      </p>
    </div>
  );
};

export default Register;
