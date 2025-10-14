import React, { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import axios from "axios";
import { fetchCountryDialCodes } from "../utils/countryCodes";
import { formatPhone10 } from "../utils/phoneFormat";
import { useUser } from "../contextAPI/UserContext";
import Header from "../components/Header";

const Login = () => {
  const { showNotification } = useOutletContext();
  const [countryCodes, setCountryCodes] = useState([]);
  const [form, setForm] = useState({
    countryCode: "+90",
    phoneDigits: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useUser();
  useEffect(() => {
    (async () => {
      const codes = await fetchCountryDialCodes();
      setCountryCodes(codes);
      const tr = codes.find((c) => c.code === "TR");
      if (tr) {
        setForm((f) => ({ ...f, countryCode: tr.dial_code }));
      }
    })();
  }, []);

  const handleBasicChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    setForm((f) => ({ ...f, phoneDigits: digits }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.phoneDigits.length !== 10) {
      showNotification("Telefon numarasını 10 hane olarak giriniz.");
      return;
    }
    if (form.password.length < 3) {
      showNotification("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    setLoading(true);

    const fullPhone = `${form.countryCode}${form.phoneDigits}`;

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/login`,
        {
          phone: fullPhone,
          password: form.password,
        }
      );
      if (data.success) {
        localStorage.setItem("token", data.token);
        setUser(data.user);
        showNotification("🔔Başarıyla giriş yapıldı.");
        navigate("/chat", { replace: true });
      } else {
        showNotification(data.message || "Giriş başarısız");
      }
    } catch (err) {
      console.error("Login error:", err);
      showNotification(err?.response?.data?.message || "Sunucu hatası");
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
        <h2>Giriş Yap</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
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
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        <p className="auth-switch">
          <span>
            Hesabınız yok mu? <Link to="/register">Kayıt olun</Link>
          </span>
          <span>
            <Link to="/change-password"> Şifrenizi mi unuttunuz?</Link>
          </span>
        </p>
      </div>
    </>
  );
};

export default Login;
