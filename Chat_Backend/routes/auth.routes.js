// routes/auth.routes.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/Users.js";
import dotenv from "dotenv";
import crypto from "crypto";
dotenv.config();
const router = express.Router();
import sendMail from "../config/mailSender.js"
import {mongoose} from "mongoose"

import {authMiddleware } from "../middleware/auth.js"
// Register
router.post("/register", async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    // Zorunlu alan kontrolü
    if (!username || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: "Tüm alanlar zorunlu" });
    }

    // Kullanıcı var mı?
    const existingUser = await User.findOne({
      $or: [{ username }, { email }, { phone }],
    });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Kullanıcı zaten kayıtlı" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verifyCode = crypto.randomInt(100000, 999999).toString();
    const user = await User.create({
      username,
      email,
      phone,
      password_hash: hashedPassword,
      verifyCode,
      verifyCodeExpires: Date.now() + 10 * 60 * 1000, // 10 dk geçerli
    });

    const emailTemplate =  `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>E-posta Doğrulama</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f6f6f6;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 6px 18px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #6a11cb, #2575fc);
      color: white;
      padding: 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .body {
      padding: 30px;
      color: #333;
      line-height: 1.6;
      text-align: center;
    }
    .body h2 {
      margin-top: 0;
      color: #6a11cb;
    }
    .code-box {
      display: inline-block;
      margin: 20px 0;
      padding: 14px 24px;
      background: #f1f1f1;
      border-radius: 8px;
      font-weight: bold;
      font-size: 24px;
      letter-spacing: 8px;
      color: #2575fc;
      border: 2px dashed #2575fc;
    }
    .footer {
      text-align: center;
      padding: 15px;
      font-size: 12px;
      color: #888;
      background: #f1f1f1;
    }
    .footer a {
      color: #2575fc;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- HEADER -->
    <div class="header">
      <h1>Chat Uygulaması</h1>
    </div>

    <!-- BODY -->
    <div class="body">
      <h2>Merhaba {{username}},</h2>
      <p>
        Hesabını doğrulamak için aşağıdaki <strong>doğrulama kodunu</strong> kullanabilirsin:
      </p>
      <div class="code-box">
        {{verifyCode}}
      </div>
      <p>
        Bu kod <strong>10 dakika</strong> boyunca geçerlidir. 
      </p>
      <p>
        Eğer bu isteği sen yapmadıysan bu e-postayı görmezden gelebilirsin.
      </p>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <p>Bu e-posta otomatik olarak gönderilmiştir. Soruların varsa 
      <a href="mailto:support@chatapp.com">support@chatapp.com</a> üzerinden bize ulaşabilirsin.</p>
    </div>
  </div>
</body>
</html>
    `;
    const html = emailTemplate
  .replace("{{username}}", user.username)
  .replace("{{verifyCode}}", verifyCode);

    sendMail(user.email,{subject:"Email Doğrulaması",html})
    
    res.status(201).json({ success: true, message: "Kayıt başarılı, e-posta doğrulama bekleniyor" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

// 📌 LOGIN
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

    if (!token) {
      return res.status(400).json({ success: false, message: "Token bulunamadı" });
    }

    const decoded = jwt.decode(token);
    if (!decoded?.exp) {
      return res.status(400).json({ success: false, message: "Geçersiz token" });
    }

    // Token expire süresine kadar blacklist’te tut
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);

    await redisClient.setEx(`blacklist:${token}`, ttl, "true");

    return res.json({ success: true, message: "Çıkış yapıldı" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password_hash -__v");
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

    res.json({ success: true, user });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

    // 📌 Kod kontrolü
    if (user.verifyCode !== code || user.verifyCodeExpires < Date.now()) {
      return res.status(400).json({ success: false, message: "Kod geçersiz veya süresi dolmuş" });
    }

    // ✅ Başarılı
    user.emailVerified = true;
    user.verifyCode = null;
    user.verifyCodeExpires = null;
    await user.save();

    res.json({ success: true, message: "E-posta başarıyla doğrulandı" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


router.patch("/profile", /*auth,*/ async (req, res) => {
  try {
    const { user_id, username, about, avatar } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, message: "user_id gerekli" });
    }

    const payload = {};
    if (typeof username === "string") payload.username = username.trim();
    if (typeof about === "string") payload.about = about.trim();

    if (typeof avatar === "string") {
      payload.avatar = {
        key: avatar.trim(),
        url: "",            // sıfırla → ilk kullanımda yeni presigned üretilecek
        url_expiresAt: null
      };
    }

    if (!Object.keys(payload).length) {
      return res.status(400).json({ success: false, message: "Güncellenecek alan yok" });
    }

    // Güncelle
    let updated = await User.findByIdAndUpdate(
      user_id,
      { $set: payload, $currentDate: { updated_at: true } },
      { new: true, projection: { password_hash: 0, __v: 0 } }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // ✅ Avatar güncel URL üret (eğer key varsa)
    if (updated.avatar?.key) {
      const url = await updated.getAvatarUrl();
      updated.avatar.url = url;
    }
    console.log("data: ",updated)
    res.json({ success: true, user: updated.toObject() });
  } catch (err) {
    console.error("profile patch error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


router.put("/settings",async (req,res) => {
  const {theme, notifications, chatBgImage, chatBgColor, userId} = req.body;
  try{
    const user = await User.findByIdAndUpdate(userId,{
     $set: {
      "settings.chatBgImage": chatBgImage,
      "settings.chatBgColor": chatBgColor,
      "settings.notifications":notifications,
      "settings.theme":theme
    }
  },{new:true});
  
  if(!user){
    return res.json({error:"Ayarlar güncellenemedi."});
  }

  res.json({
    success:true,
    user:{_id: user._id , settings: user.settings}
  })

  }catch(err){
    console.log("/settings API Error!")
    res.json({error:err.message})
  }

})

router.put("/friends", async (req, res) => {
  try {
    const { userId, friendId } = req.body;

    // Eksik parametre kontrolü
    if (!userId || !friendId) {
      return res.status(400).json({ message: "userId ve friendId gerekli ❗" });
    }

    // Kullanıcıları bul
    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!user || !friend) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı ❌" });
    }

    // Zaten arkadaş mı?
    if (user.friends.includes(friendId)) {
      return res.status(400).json({ message: "Zaten arkadaşsınız 🤝" });
    }

    // Arkadaş ekleme (karşılıklı)
    user.friends.push(friendId);
    friend.friends.push(userId);

    await user.save();
    await friend.save();

    return res.status(200).json({ message: "Arkadaş eklendi ✔️" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Sunucu hatası ⚠️" });
  }
});

router.get("/:id/friends", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Geçersiz kullanıcı id" });
    }

    // Kullanıcıyı bul + arkadaşlarını populate et
    const user = await User.findById(id)
      .populate("friends", "_id username status about avatar.url")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // Arkadaş listesini döndür
    return res.json({
      success: true,
      friends: user.friends || []
    });
  } catch (err) {
    console.error("GET /user/:id/friends", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
}); 

router.get("/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("username email avatar last_seen");

    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    const avatar = await user.getAvatarUrl();
    if(avatar){
      user.avatar=avatar
    }
    res.json(user);
  } catch (err) {
    console.log("error: ",err.message)
    res.status(500).json({ message: "Sunucu hatası", error: err.message });
  }
})

router.post("/friends/request", async (req, res) => {
  try {
    const { fromUserId, phone } = req.body;

    const fromUser = await User.findById(fromUserId);
    const toUser = await User.findOne({ phone });

    if (!toUser) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    if (String(fromUser._id) === String(toUser._id)) {
      return res.status(400).json({ success: false, message: "Kendi kendine istek gönderemezsin 🚫" });
    }

    if (fromUser.friends.includes(toUser._id)) {
      return res.json({ success: false, message: "Zaten arkadaşsınız 🤝" });
    }

    // 🎯 Karşı taraf zaten bana istek göndermiş mi?
    if (fromUser.friend_requests.includes(toUser._id)) {
      // ✅ Her iki taraftan da istekleri kaldır
      fromUser.friend_requests = fromUser.friend_requests.filter(
        (id) => String(id) !== String(toUser._id)
      );
      toUser.friend_requests = toUser.friend_requests.filter(
        (id) => String(id) !== String(fromUser._id)
      );

      // karşılıklı arkadaş olarak ekle
      fromUser.friends.push(toUser._id);
      toUser.friends.push(fromUser._id);

      await fromUser.save();
      await toUser.save();

      return res.json({
        success: true,
        autoAccepted: true,
        message: "Karşılıklı istek vardı, otomatik arkadaş oldunuz 🤝",
        toUserId: toUser._id,
        fromUser: fromUser
      });
    }

    // Daha önce aynı istek var mı?
    if (toUser.friend_requests.includes(fromUserId)) {
      return res.json({ success: false, message: "Zaten istek göndermişsiniz 📩" });
    }

    // ✅ Normal istek gönderme
    toUser.friend_requests.push(fromUserId);
    await toUser.save();

    return res.json({
      success: true,
      message: "Arkadaşlık isteği gönderildi ✅",
      toUserId: toUser._id,
      fromUser: fromUser
    });
  } catch (err) {
    console.error("Arkadaşlık isteği hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});




// GET /api/friends/requests/:userId
router.get("/friends/requests/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate("friend_requests", "username avatar status about phone");

    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // 🔥 Avatarları güncelle
    const requests = [];
    for (const u of user.friend_requests) {
      const avatar = await u.getAvatarUrl();
      if (avatar) u.avatar = avatar;
      requests.push(u);
    }

    res.json({ success: true, requests });
  } catch (err) {
    console.error("GET /friends/requests error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

// PATCH /api/friends/accept
router.patch("/friends/accept", async (req, res) => {
  try {
    const { userId, fromUserId } = req.body;

    const user = await User.findById(userId);
    const fromUser = await User.findById(fromUserId);

    if (!user || !fromUser) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // request sil
    user.friend_requests = user.friend_requests.filter(id => String(id) !== String(fromUserId));

    // arkadaş listesine ekle
    if (!user.friends.includes(fromUserId)) user.friends.push(fromUserId);
    if (!fromUser.friends.includes(userId)) fromUser.friends.push(userId);

    await user.save();
    await fromUser.save();

    res.json({ success: true, message: "Arkadaşlık isteği kabul edildi", user:user});
  } catch (err) {
    console.error("PATCH /friends/accept error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

// PATCH /api/friends/reject
router.patch("/friends/reject", async (req, res) => {
  try {
    const { userId, fromUserId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }
   
    // request listeden çıkar
    user.friend_requests = user.friend_requests.filter(id => String(id) !== String(fromUserId));
    await user.save();
    res.json({ success: true, message: "Arkadaşlık isteği reddedildi",toUsername:user.username});
  } catch (err) {
    console.error("PATCH /friends/reject error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

router.get("/friends/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate("friends", "username avatar status about phone");

    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // 🔥 Avatarları güncelle
    const friends = [];
    for (const f of user.friends) {
      const avatar = await f.getAvatarUrl();
      if (avatar) f.avatar = avatar;
      friends.push(f);
    }

    res.json({ success: true, friends });
  } catch (err) {
    console.error("GET /friends error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

router.patch("/friends/remove", async (req, res) => {
  try {
    const { userId, friendId } = req.body;

    if (!userId || !friendId) {
      return res.status(400).json({ success: false, message: "userId ve friendId gerekli ❗" });
    }

    if (String(userId) === String(friendId)) {
      return res.status(400).json({ success: false, message: "Kendini silemezsin 🚫" });
    }

    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!user || !friend) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı ❌" });
    }

    // Arkadaş listesinden çıkar
    user.friends = user.friends.filter((id) => String(id) !== String(friendId));
    friend.friends = friend.friends.filter((id) => String(id) !== String(userId));

    await user.save();
    await friend.save();

    return res.json({ success: true, message: "Arkadaş silindi ✔️", friendId });
  } catch (err) {
    console.error("Arkadaş silme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});




export default router;
