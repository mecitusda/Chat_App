// routes/auth.routes.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/Users.js";
import dotenv from "dotenv";
import crypto from "crypto";
dotenv.config();
import { client as redis } from "../utils/redis.js";
const router = express.Router();
import sendMail from "../config/mailSender.js"
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const RESET_CODE_TTL_SEC = 120; // 2 dakika
const RESET_JWT_TTL = "5m";
// POST

router.post("/register", async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    if (!username || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: "Tüm alanlar zorunlu" });
    }

    const existingUser = await User.findOne({ $or: [{ username }, { email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Kullanıcı zaten kayıtlı" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 6 haneli kod
    const verifyCode = crypto.randomInt(100000, 999999).toString();

    // Kullanıcıyı oluştur (DB’de saklamak istiyorsan alanlar kalabilir ama şart değil)
    const user = await User.create({
      username,
      email,
      phone,
      password_hash: hashedPassword,
      // İstersen bu iki alanı artık kullanma; Redis TTL zaten daha güvenli:
      verifyCode,                           // (opsiyonel)
      verifyCodeExpires: Date.now() + 2 * 60 * 1000, // (opsiyonel) 2 dk
      emailVerified: false,
    });

    await redis.set(`verify:${email}`, verifyCode, { EX: 120 }); // 120sn

    // Mail şablonu
    const emailTemplate = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>E-posta Doğrulama</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f6f6f6; margin:0; padding:0; }
    .container { max-width:600px; margin:40px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,0.1); }
    .header { background:linear-gradient(135deg, #6a11cb, #2575fc); color:#fff; padding:20px; text-align:center; }
    .header h1 { margin:0; font-size:24px; }
    .body { padding:30px; color:#333; line-height:1.6; text-align:center; }
    .body h2 { margin-top:0; color:#6a11cb; }
    .code-box { display:inline-block; margin:20px 0; padding:14px 24px; background:#f1f1f1; border-radius:8px; font-weight:bold; font-size:24px; letter-spacing:8px; color:#2575fc; border:2px dashed #2575fc; }
    .footer { text-align:center; padding:15px; font-size:12px; color:#888; background:#f1f1f1; }
    .footer a { color:#2575fc; text-decoration:none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Scriber</h1></div>
    <div class="body">
      <h2>Merhaba {{username}},</h2>
      <p>Hesabını doğrulamak için aşağıdaki <strong>doğrulama kodunu</strong> kullanabilirsin:</p>
      <div class="code-box">{{verifyCode}}</div>
      <p>Bu kod <strong>2 dakika</strong> boyunca geçerlidir.</p>
      <p>Eğer bu isteği sen yapmadıysan bu e-postayı görmezden gelebilirsin.</p>
    </div>
    <div class="footer">
      <p>Bu e-posta otomatik olarak gönderilmiştir. Soruların varsa
      <a href="mailto:usda.mecit@gmail.com">usda.mecit@gmail.com</a> üzerinden bize ulaşabilirsin.</p>
    </div>
  </div>
</body>
</html>`;

    const html = emailTemplate
      .replace("{{username}}", user.username)
      .replace("{{verifyCode}}", verifyCode);

    await sendMail(user.email, { subject: "Email Doğrulaması", html });

    return res.status(201).json({
      success: true,
      message: "Kayıt başarılı, e-posta doğrulama bekleniyor",
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: "Telefon ve şifre gerekli" });
    }
    const user = await User.findOne({ phone:phone }).select("-verifyCode -verifyCodeExpires");
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: "Şifre hatalı" });
    }

    // ✅ Avatar URL expired mi kontrol et
    if (user.avatar?.key) {
      const avatarObj = await user.getAvatarUrl();
      user.avatar.url = avatarObj.newUrl || avatarObj; // senin getAvatarUrl yapına göre
      user.avatar.url_expiresAt = avatarObj.url_expiresAt || null;
    }

    // ✅ JWT oluştur
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // ✅ Temiz user objesi
    const safeUser = user.toObject();
    delete safeUser.password_hash;
    delete safeUser.__v;

    res.json({ success: true, token, user: safeUser });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    console.log("token:",token)
    if (!token) {
      return res.status(400).json({ success: false, message: "Token bulunamadı" });
    }

    const decoded = jwt.decode(token);
    if (!decoded?.exp) {
      return res.status(400).json({ success: false, message: "Geçersiz token" });
    }

    // Token expire süresine kadar blacklist’te tut
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);

    await redis.setEx(`blacklist:${token}`, ttl, "true");
    return res.json({ success: true, message: "Çıkış yapıldı" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

router.post("/send-reset-code", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "E-posta zorunlu" });

    const user = await User.findOne({ email });
    if (!user) return res.json({ success: true, message: "Kod gönderildi (varsa)" });

    // Rate-limit (1 dk arayla)
    const keyLimit = `reset:limit:${email}`;
    if (await redis.exists(keyLimit))
      return res.status(429).json({ success: false, message: "Lütfen biraz sonra tekrar deneyin." });

    const code = crypto.randomInt(100000, 999999).toString();
    const hash = await bcrypt.hash(code, 10);

    // Hash ve süreyi Redis’e yaz
    const key = `reset:code:${email}`;
    await redis.setEx(key, RESET_CODE_TTL_SEC, hash);
    await redis.setEx(keyLimit, 60, "1"); // rate-limit anahtarı

    // E-posta gönder
    const html =  `
  <!DOCTYPE html>
  <html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Şifre Sıfırlama Kodu</title>
    <style>
      body {
        background-color: #f6f6f6;
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
        color: #333;
      }
      .container {
        max-width: 600px;
        margin: 40px auto;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 6px 18px rgba(0,0,0,0.1);
        overflow: hidden;
      }
      .header {
        background: linear-gradient(135deg, #6a11cb, #2575fc);
        color: #fff;
        text-align: center;
        padding: 24px;
      }
      .body {
        text-align: center;
        padding: 32px 20px;
      }
      .body h2 {
        color: #2575fc;
        margin-bottom: 20px;
        font-size: 22px;
      }
      .code-box {
        display: inline-block;
        padding: 18px 32px;
        background: #f8f9ff;
        border: 3px dashed #2575fc;
        border-radius: 10px;
        font-size: 28px;
        font-weight: bold;
        letter-spacing: 10px;
        color: #2575fc;
        margin: 25px 0;
      }
      .footer {
        background: #f1f1f1;
        text-align: center;
        padding: 15px;
        font-size: 12px;
        color: #888;
      }
      .footer a {
        color: #2575fc;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Şifre Sıfırlama Talebi</h1>
      </div>
      <div class="body">
        <h2>Şifre sıfırlama kodunuz</h2>
        <div class="code-box">${code}</div>
        <p>Bu kod <strong>2 dakika</strong> boyunca geçerlidir.</p>
      </div>
      <div class="footer">
        <p>Bu e-posta otomatik olarak gönderilmiştir.<br/>
        Sorularınız için <a href="mailto:usda.mecit@gmail.com">usda.mecit@gmail.com</a> adresine ulaşabilirsiniz.</p>
      </div>
    </div>
  </body>
  </html>
`;
    await sendMail(email, { subject: "Şifre Sıfırlama Kodu", html });

    return res.json({ success: true, message: "Kod gönderildi" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

router.post("/verify-reset-code", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ success: false, message: "Eksik bilgi" });

    const key = `reset:code:${email}`;
    const hash = await redis.get(key);
    if (!hash) return res.status(400).json({ success: false, message: "Kodun süresi dolmuş" });

    const ok = await bcrypt.compare(code, hash);
    if (!ok) return res.status(400).json({ success: false, message: "Kod hatalı" });

    // Tek kullanımlık token
    const jti = crypto.randomUUID();
    const token = jwt.sign({ email, jti, action: "password_reset" }, JWT_SECRET, {
      expiresIn: RESET_JWT_TTL,
    });

    // Redis'e "doğrulandı" durumu kaydı (tek kullanımlık)
    await redis.setEx(`reset:token:${email}`, 300, jti);
    await redis.del(key); // kod artık silinir

    return res.json({ success: true, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


router.post("/change-password-email", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword)
      return res.status(400).json({ success: false, message: "Eksik bilgi" });

    if (newPassword.length < 6)
      return res
        .status(400)
        .json({ success: false, message: "Şifre en az 6 karakter olmalı" });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res
        .status(401)
        .json({ success: false, message: "Token geçersiz veya süresi dolmuş" });
    }

    if (payload.action !== "password_reset")
      return res
        .status(401)
        .json({ success: false, message: "Geçersiz işlem" });

    const redisJti = await redis.get(`reset:token:${payload.email}`);
    if (!redisJti || redisJti !== payload.jti)
      return res.status(401).json({
        success: false,
        message: "Token zaten kullanılmış veya geçersiz",
      });

    const user = await User.findOne({ email: payload.email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Kullanıcı bulunamadı" });

    // 🔒 Eski şifreyle aynı mı kontrol et
    const isSamePassword = await bcrypt.compare(
      newPassword,
      user.password_hash
    );
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "Yeni şifre eski şifreyle aynı olamaz",
      });
    }

    // Yeni şifreyi hashle ve kaydet
    user.password_hash = await bcrypt.hash(newPassword, 10);
    await user.save();

    // Token iptal (replay engeli)
    await redis.del(`reset:token:${payload.email}`);

    return res.json({
      success: true,
      message: "Şifre başarıyla değiştirildi",
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Sunucu hatası" });
  }
});

router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ success: false, message: "E-posta gerekli" });

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Bu e-posta ile kayıtlı kullanıcı yok" });

    if (user.emailVerified)
      return res.json({ success: false, message: "E-posta zaten doğrulanmış" });

    // Yeni kod üret
    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Eski kodu geçersiz kıl
    await redis.del(`verify:${email}`);

    // Yeni kodu 2 dakika boyunca geçerli olacak şekilde sakla
    await redis.set(`verify:${email}`, verifyCode, "EX", RESET_JWT_TTL);

    // Token (isteğe bağlı)
    const token = jwt.sign(
      { email, code: verifyCode, action: "email_verify" },
      JWT_SECRET,
      { expiresIn: "2m" }
    );

    // Mail gönder
    const subject = "📧 Yeni E-Posta Doğrulama Kodunuz";
    const html = `
      <div style="font-family: Arial, sans-serif; padding:20px; background:#f9f9f9;">
        <h2 style="color:#333;">E-posta Doğrulama Kodunuz</h2>
        <p>Merhaba ${user.username},</p>
        <p>Yeni doğrulama kodunuz aşağıdadır:</p>
        <div style="font-size:22px; font-weight:bold; color:#ff5f6d; letter-spacing:6px;">${verifyCode}</div>
        <p>Bu kod 2 dakika boyunca geçerlidir.</p>
        <p>Eğer bu isteği siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
      </div>
    `;

    await sendEmail(user.email, subject, html);

    return res.json({
      success: true,
      message: "Yeni doğrulama kodu gönderildi",
      token,
    });
  } catch (err) {
    console.error("resend-verification error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Sunucu hatası oluştu" });
  }
});

router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code)
      return res
        .status(400)
        .json({ success: false, message: "E-posta ve kod gereklidir" });

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Kullanıcı bulunamadı" });

    if (user.emailVerified)
      return res.json({ success: false, message: "E-posta zaten doğrulanmış" });

    // Redis'teki kodu çek
    const storedCode = await redis.get(`verify:${email}`);
    if (!storedCode)
      return res
        .status(401)
        .json({ success: false, message: "Kodun süresi dolmuş veya geçersiz" });

    if (storedCode !== code)
      return res
        .status(400)
        .json({ success: false, message: "Kod hatalı" });

    // Başarılıysa:
    user.emailVerified = true;
    await user.save();

    // Kodu iptal et (replay engeli)
    await redis.del(`verify:${email}`);

    // Yeni JWT (isteğe bağlı)
    const token = jwt.sign(
      { userId: user._id, action: "email_verified" },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    return res.json({
      success: true,
      message: "E-posta başarıyla doğrulandı",
      token,
    });
  } catch (err) {
    console.error("verify-email error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Sunucu hatası oluştu" });
  }
});


export default router;
