import React, { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import axios from "axios";
import { fetchCountryDialCodes } from "../utils/countryCodes";
import { formatPhone10 } from "../utils/phoneFormat";
import { useUser } from "../contextAPI/UserContext";

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
      alert("Telefon numarasını 10 hane olarak giriniz.");
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
      alert(err?.response?.data?.message || "Sunucu hatası");
    } finally {
      setLoading(false);
    }
  };

  return (
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
        Hesabın yok mu? <Link to="/register">Kayıt ol</Link>
      </p>
    </div>
  );
};

export default Login;
