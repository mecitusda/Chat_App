import express from "express";
const router = express.Router();
import Contact from "../models/contacts.js"
import sendMail from "../config/mailSender.js"
import { client as redis } from "../utils/redis.js";


router.post("/", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !message) {
      return res
        .status(400)
        .json({ success: false, message: "Zorunlu alanlar eksik" });
    }

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

      await redis.set(key, 1, { EX: 86400 });
    } else {

      await redis.incr(key);
    }


    const contact = await Contact.create({ name, email, phone, message });

  
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
      message: "Mesajınız başarıyla gönderildi",
      data: contact,
    });
  } catch (err) {
    console.error("Contact error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Sunucu hatası oluştu" });
  }
});

router.get("/", async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json({ success: true, data: contacts });
  } catch (err) {
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


export default router;
