// pages/VerifyEmail.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import axios from "axios";

const VerifyEmail = () => {
  const { showNotification } = useOutletContext();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;
  useEffect(() => {
    if (!email) {
      navigate("/register", { replace: true });
    }
  }, [email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/verify-email`,
        {
          email,
          code,
        }
      );
      if (data.success) {
        showNotification("🔔Email'iniz onaylandı.");
        navigate("/login", { replace: true });
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
      showNotification("🔔Sunucu hatası.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h2>E-posta Doğrulama</h2>
      <p>{email} adresine gelen doğrulama kodunu girin</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Doğrulama kodu"
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Doğrulanıyor..." : "Doğrula"}
        </button>
      </form>
    </div>
  );
};

export default VerifyEmail;
