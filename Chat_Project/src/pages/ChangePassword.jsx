import React, { useState, useEffect } from "react";
import { useNavigate, useOutletContext, Link } from "react-router-dom";
import axios from "axios";
import { TextField, InputAdornment, IconButton } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import OTPInput from "../components/OTPInput";
import { CountdownCircleTimer } from "react-countdown-circle-timer";
import PasswordInput from "../components/PasswordInput";

const Countdown = ({ duration, onComplete }) => (
  <CountdownCircleTimer
    isPlaying
    duration={duration}
    colors={["#FFD700", "#FF8C00", "#FF0000"]}
    colorsTime={[duration, duration / 2, 0]}
    strokeWidth={8}
    size={80}
    trailColor="#444"
    onComplete={onComplete}
  >
    {({ remainingTime }) => {
      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;
      return (
        <div style={{ color: "#fff", fontWeight: "bold", fontSize: "1.2rem" }}>
          {`${minutes}:${seconds.toString().padStart(2, "0")}`}
        </div>
      );
    }}
  </CountdownCircleTimer>
);

const ChangePassword = () => {
  const { showNotification } = useOutletContext();
  const [step, setStep] = useState(1); // 1: email -> 2: code -> 3: new password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const navigate = useNavigate();

  // Timer countdown
  useEffect(() => {
    if (timer <= 0) return;
    const t = setInterval(() => setTimer((x) => x - 1), 1000);
    return () => clearInterval(t);
  }, [timer]);

  const sendCode = async () => {
    if (!email.includes("@")) {
      showNotification("Geçerli bir e-posta adresi giriniz.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/send-reset-code`,
        { email }
      );
      if (data.success) {
        showNotification("📧 Kod e-postanıza gönderildi!");
        setStep(2);
        setTimer(120); // 2 dakika
      } else showNotification(data.message || "Kod gönderilemedi.");
    } catch (err) {
      showNotification(err?.response?.data?.message || "Sunucu hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (manualOtp) => {
    const codeToCheck = manualOtp || otp; // 🔥 parametre varsa onu al
    if (codeToCheck.length < 6) {
      showNotification("Kod eksik veya hatalı.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/verify-reset-code`,
        { email, code: codeToCheck }
      );
      if (data.success) {
        showNotification("✅ Kod doğrulandı, yeni şifrenizi belirleyin.");
        localStorage.setItem("resetToken", data.token);
        setStep(3);
      } else {
        showNotification(data.message || "Kod geçersiz.");
      }
    } catch (err) {
      showNotification(err?.response?.data?.message || "Sunucu hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (e) =>
    setPasswords((p) => ({ ...p, [e.target.name]: e.target.value }));

  const changePassword = async (e) => {
    e.preventDefault();
    const { newPassword, confirmPassword } = passwords;
    const token = localStorage.getItem("resetToken");

    if (newPassword.length < 6) {
      showNotification("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification("Şifreler eşleşmiyor!");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/change-password-email`,
        { token, newPassword }
      );
      if (data.success) {
        showNotification("✅ Şifre başarıyla değiştirildi.");
        localStorage.removeItem("resetToken");
        navigate("/login", { replace: true });
      } else {
        showNotification(data.message || "Şifre değiştirilemedi.");
      }
    } catch (err) {
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
        <h2>Şifre Değiştir</h2>

        {/* STEP 1: Email */}
        {step === 1 && (
          <div className="auth-form">
            <TextField
              type="email"
              label="E-posta Adresi"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              margin="normal"
              required
              onKeyDown={(e) => e.key === "Enter" && sendCode()} // 🔥 Enter ile gönder
              sx={{
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "#1c1c1c",
                  borderRadius: "10px",
                  color: "#fff",
                  "& fieldset": {
                    borderColor: "#fff", // normal border
                  },
                  "&:hover fieldset": {
                    borderColor: "#fff", // hover’da da beyaz
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#fff", // 🔥 focus'ta beyaz border
                  },
                },
                "& .MuiInputBase-input": {
                  color: "#fff", // yazı rengi beyaz
                },
                "& .MuiInputLabel-root": {
                  color: "#aaa", // label rengi normalde gri
                },
                "& .MuiInputLabel-root.Mui-focused": {
                  color: "#fff", // 🔥 focus olduğunda label beyaz
                },
              }}
            />
            <button onClick={sendCode} disabled={loading}>
              {loading ? "Gönderiliyor..." : "Kodu Gönder"}
            </button>
          </div>
        )}

        {/* STEP 2: Kod Girişi */}
        {step === 2 && (
          <div className="auth-form">
            <div className="change_password">
              <h4>E-postana gelen kodu gir</h4>
              <OTPInput
                value={otp}
                onChange={(val) => {
                  setOtp(val);
                  if (val.length === 6) verifyCode(val); // 🔥 6. hanede otomatik gönder
                }}
                length={6}
              />

              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {timer > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <Countdown
                      duration={timer}
                      onComplete={() => setTimer(0)}
                    />
                    <span style={{ marginTop: "8px", fontSize: "0.9rem" }}>
                      Kod yeniden gönderilebilir
                    </span>
                  </div>
                ) : (
                  <button onClick={sendCode}>Kodu Yeniden Gönder</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Yeni Şifre */}
        {step === 3 && (
          <form className="auth-form" onSubmit={changePassword}>
            <PasswordInput
              value={passwords.newPassword}
              onChange={(e) =>
                setPasswords((p) => ({ ...p, newPassword: e.target.value }))
              }
              placeholder="Yeni Şifre"
            />
            <PasswordInput
              value={passwords.confirmPassword}
              onChange={(e) =>
                setPasswords((p) => ({ ...p, confirmPassword: e.target.value }))
              }
              placeholder="Yeni Şifre (Tekrar)"
            />

            <button type="submit" disabled={loading}>
              {loading ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
            </button>
          </form>
        )}
        <p className="auth-switch">
          <span style={{ textAlign: "start" }}>
            <Link to="/login">Geri dön</Link>
          </span>
        </p>
      </div>
    </>
  );
};

export default ChangePassword;
