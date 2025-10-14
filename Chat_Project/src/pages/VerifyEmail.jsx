import React, { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useOutletContext,
} from "react-router-dom";
import axios from "axios";
import OTPInput from "../components/OTPInput";
import { CountdownCircleTimer } from "react-countdown-circle-timer";

const VerifyEmail = () => {
  const { showNotification } = useOutletContext();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(120); // 2 dakika
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  useEffect(() => {
    if (!email) navigate("/register", { replace: true });
  }, [email]);

  useEffect(() => {
    if (otp.length === 6) {
      handleVerify();
    }
  }, [otp]);
  // Timer
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleVerify = async () => {
    console.log(otp);
    if (otp.length !== 6) {
      showNotification("Lütfen 6 haneli doğrulama kodunu girin.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/verify-email`,
        { email, code: otp }
      );
      if (data.success) {
        showNotification("✅ E-posta başarıyla doğrulandı!");
        navigate("/login", { replace: true });
      } else {
        showNotification(data.message || "Kod hatalı.");
      }
    } catch (err) {
      console.error(err);
      showNotification("Sunucu hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/resend-verification`,
        { email }
      );
      if (data.success) {
        showNotification("📨 Yeni kod e-postanıza gönderildi!");
        setOtp("");
        setTimer(120);
      } else {
        showNotification(data.message || "Kod gönderilemedi.");
      }
    } catch (err) {
      console.error(err);
      showNotification("Sunucu hatası oluştu.");
    }
  };

  return (
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
        </nav>
      </div>

      <div className="auth-container">
        <h2>E-posta Doğrulama</h2>
        <p>
          <strong>{email}</strong> adresine gönderilen 6 haneli kodu girin
        </p>

        <div className="change_password" style={{ marginTop: 20 }}>
          <OTPInput value={otp} onChange={setOtp} length={6} />

          <div style={{ marginTop: 20, textAlign: "center" }}>
            {timer > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <CountdownCircleTimer
                  isPlaying
                  duration={timer}
                  colors={["#00ffcc", "#ffaa00", "#ff4444"]}
                  colorsTime={[120, 60, 0]}
                  strokeWidth={8}
                  size={80}
                  trailColor="#444"
                  onComplete={() => setTimer(0)}
                >
                  {({ remainingTime }) => {
                    const minutes = Math.floor(remainingTime / 60);
                    const seconds = remainingTime % 60;
                    return (
                      <div
                        style={{
                          color: "#fff",
                          fontWeight: "bold",
                          fontSize: "1.2rem",
                        }}
                      >
                        {`${minutes}:${seconds.toString().padStart(2, "0")}`}
                      </div>
                    );
                  }}
                </CountdownCircleTimer>
                <span style={{ marginTop: "8px", fontSize: "0.9rem" }}>
                  Kodun süresi dolmadan giriş yapın
                </span>
              </div>
            ) : (
              <button onClick={resendCode} className="resend">
                Kodu Yeniden Gönder
              </button>
            )}
          </div>
        </div>

        <Link
          to="/login"
          style={{
            color: "#fff",
            textDecoration: "underline",
            marginTop: 20,
          }}
        >
          Geri dön
        </Link>
      </div>
    </>
  );
};

export default VerifyEmail;
