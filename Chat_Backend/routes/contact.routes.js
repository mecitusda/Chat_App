import express from "express";
const router = express.Router();
import Contact from "../models/contacts.js"
import sendMail from "../config/mailSender.js"
import { client as redis } from "../utils/redis.js";

// 📩 Mesaj gönder (Formdan gelen veriyi kaydet)
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !message) {
      return res
        .status(400)
        .json({ success: false, message: "Zorunlu alanlar eksik" });
    }

    // 🔍 Kullanıcı IP'sini al (proxy arkasında ise gerçek IP’yi çek)
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.connection.remoteAddress ||
      "unknown";

    const key = `contact:count:${ip}`;
    const currentCount = await redis.get(key);

    if (currentCount && parseInt(currentCount) >= 2) {
      return res.status(429).json({
        success: false,
        message:
          "Günlük mesaj limitine ulaştınız. Lütfen yarın tekrar deneyin (maks. 15 mesaj/gün).",
      });
    }

    if (!currentCount) {
      // İlk mesaj — sayaç oluştur (24 saatlik TTL)
      await redis.set(key, 1, { EX: 86400 });
    } else {
      // Sayaç artır
      await redis.incr(key);
    }

    // 🧾 Mesajı MongoDB'ye kaydet
    const contact = await Contact.create({ name, email, phone, message });

    // (Opsiyonel) Destek ekibine mail bildirimi
    try {
      await sendMail("usda.mecit@gmail.com", {
        subject: `Scriber - iletişim aldın: ${name}`,
        html: `
          <div style="font-family:sans-serif">
            <h3>Yeni İletişim Mesajı</h3>
            <p><strong>Ad:</strong> ${name}</p>
            <p><strong>E-posta:</strong> ${email}</p>
            <p><strong>Telefon:</strong> ${phone || "-"}</p>
            <p><strong>IP:</strong> ${ip}</p>
            <p><strong>Mesaj:</strong></p>
            <p>${message}</p>
          </div>
        `,
      });
    } catch (mailErr) {
      console.warn("E-posta gönderimi başarısız:", mailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Mesajınız başarıyla gönderildi ✅",
      data: contact,
    });
  } catch (err) {
    console.error("Contact error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Sunucu hatası oluştu" });
  }
});

// (Opsiyonel) Admin paneli için mesaj listesi
router.get("/", async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json({ success: true, data: contacts });
  } catch (err) {
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


export default router;
