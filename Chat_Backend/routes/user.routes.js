import express from "express";
const router = express.Router();
import {authMiddleware } from "../middleware/auth.js"
import User from "../models/Users.js";
import mongoose  from "mongoose";
// GET

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
    console.log("friends: ",friends)

    res.json({ success: true, friends });
  } catch (err) {
    console.error("GET /friends error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
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

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password_hash -__v");
      console.log("kullanıcı: ",user)
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
  
    res.json({ success: true, user });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }

});


router.get("/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("username email avatar last_seen emailVerified");

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


// POST 

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

// PUT 

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
// DELETE


// PATCH


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

router.patch("/profile", async (req, res) => {
  try {
    const { user_id, username, about, avatar } = req.body;

    if (!user_id)
      return res
        .status(400)
        .json({ success: false, message: "Kullanıcı ID gerekli." });

    const user = await User.findById(user_id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Kullanıcı bulunamadı." });

    // 🔹 Kullanıcı adı
    if (username !== undefined && username.trim()) {
      user.username = username.trim();
    }

    // 🔹 Hakkında
    if (about !== undefined) {
      user.about = about.trim();
    }

    // 🔹 Avatar (S3 key geldiyse)
    if (avatar) {
      user.avatar.key = avatar;
      const newUrl = await getSignedUrlFromStorage(avatar);
      user.avatar.url = newUrl;
      user.avatar.url_expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 gün geçerli
    }

    await user.save();
    const jsonUser = user.toJSON();

    return res.status(200).json({
      success: true,
      message: "Profil başarıyla güncellendi.",
      user: jsonUser,
    });
  } catch (err) {
    console.error("Profil güncelleme hatası:", err);
    return res.status(500).json({
      success: false,
      message: "Profil güncellenirken bir hata oluştu.",
      error: err.message,
    });
  }
})





export default router;
