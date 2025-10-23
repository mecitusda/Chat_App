import express from "express";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/Users.js"
import Call from "../models/Call.js"
const router = express.Router();
import mongoose from "mongoose"
const { Types: { ObjectId } } = mongoose;




// GET

// router.get("/last-seen",async (req,res) => {
//   try{
//     const format = String(req.query.format || "iso").toLowerCase(); // "iso" | "ms"
//     const users = await User.find({});
//     const userMap = {};
//     for (const d of users) {
//       const t = d.last_seen ? new Date(d.last_seen) : null;
//       userMap[String(d._id)] =
//         t && !isNaN(t.getTime())
//           ? format === "ms"
//             ? t.getTime() // number (epoch ms)
//             : t.toISOString() // string
//           : null; // hiç last_seen yoksa
//     }
//     res.json({ success: true, count: userMap.length, lastSeen: userMap });
//   }catch(err){
//      console.error("GET /users/last-seen error:", err.message);
//     res.status(500).json({ success: false, error: "Sunucu hatası: " +err.message });
//   }
// });

router.get("/messages/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    let { limit, after, before, populate, userId } = req.query;

    const LIM = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    // 1) Query
    const query = { conversation: conversationId };
    const idCond = {};
    if (after && ObjectId.isValid(after)) idCond.$gt = new ObjectId(after);
    if (before && ObjectId.isValid(before)) idCond.$lt = new ObjectId(before);
    if (Object.keys(idCond).length) query._id = idCond;

    // 2) Sort
    const sort = after ? { _id: 1 } : before ? { _id: -1 } : { _id: -1 };

    // 3) Limit + 1 (probe) — LEAN KULLANMA, method’lar lazım
    let q = Message.find(query).sort(sort).limit(LIM + 1);
    if (populate && (populate === "1" || populate === "true")) {
      q = q.populate("sender", "username avatar status about");
    }
    let docs = await q.exec();

    // 4) hasMore
    const hasMoreRaw = docs.length > LIM;
    if (hasMoreRaw) docs = docs.slice(0, LIM);

    // 5) UI sırası
    const reverseNeeded = !after;
    if (reverseNeeded) docs = docs.reverse();

    // 6) Cursorlar
    const oldestId = docs.length ? String(docs[0]._id) : null;
    const newestId = docs.length ? String(docs[docs.length - 1]._id) : null;
    const hasMoreBefore = !after ? hasMoreRaw : null;
    const hasMoreAfter = after ? hasMoreRaw : null;
    const nextAfter = newestId;
    const prevBefore = oldestId;

    // 7) lastRead güncelle
    if (docs.length > 0 && userId) {
      await Conversation.findOneAndUpdate(
        { _id: conversationId, "members.user": userId },
        {
          $set: {
            "members.$.lastReadMessageId": docs[docs.length - 1]._id,
            "members.$.lastReadAt": new Date(),
          },
        }
      );
    }

    // 8) Medya + sender avatar tazele
    const processedSenders = new Set();
    await Promise.all(
      docs.map(async (doc) => {
        // mesaj medyası
        if (doc.media_key && doc.getMediaUrl) {
          await doc.getMediaUrl(); // expired ise yeniler ve kaydeder
        }

        // sender avatar (populate açıksa gelir)
        const s = doc.sender;
        const senderId = s?._id ? String(s._id) : null;
        if (s?.getAvatarUrl && senderId && !processedSenders.has(senderId)) {
          s.avatar.url = await s.getAvatarUrl(); // URL’i güncelle
          processedSenders.add(senderId);
        }
      })
    );

    // 9) JSON’a çevir
    const messagesWithMedia = docs.map((d) => d.toJSON());

    res.json({
      success: true,
      messages: messagesWithMedia,
      pageInfo: {
        count: messagesWithMedia.length,
        limit: LIM,
        after: after || null,
        before: before || null,
        nextAfter,
        prevBefore,
        hasMoreBefore,
        hasMoreAfter,
      },
    });
  } catch (err) {
    console.error("GET /messages error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/conversation/:id", async (req,res) => {
  try{
    const conv = await Conversation.findById(req.params.id).sort({ updatedAt: -1 })
      .populate("last_message.sender", "username avatar")
      .populate("members.user", "username avatar status about")
      .populate("last_message.message", "")
      .populate("createdBy","")
      .populate("active_call","")

    if(!conv) return res.status(404).json({success:false, message:"Chat bulunamadı."})
    res.json({success:true, conversation:conv})
  }catch(err){
    res.status(500).json({success:false,message:err.message})
  }
})

router.get("/:id/members", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Geçersiz conversation id" });
    }

    // Sadece members içindeki user id’lerini alıyoruz
    const conv = await Conversation.findById(id)
      .select("members.user") // sadece üyeler gelsin
      .lean();

    if (!conv) {
      return res.status(404).json({ error: "Konuşma bulunamadı" });
    }

    const memberIds = conv.members.map(m => String(m.user));

    return res.json({ success: true, members: memberIds });
  } catch (err) {
    console.error("GET /conversation/:id/members", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// router.get("/:userId", async (req, res) => {
//   try {
//     const me = new mongoose.Types.ObjectId(req.params.userId);

//     // 1) Document olarak konuşmaları getir
//     let conversations = await Conversation.find({ "members.user": me })
//       .sort({ updatedAt: -1 })
//       .populate("last_message.sender", "username avatar")
//       .populate("members.user", "username phone avatar status about")
//       .populate("last_message.message", "")
//       .populate("createdBy","")
//       .populate("active_call"," ")
//       .exec();
   
//     // 2) Avatarları güncelle
//     for (const conv of conversations) {
//       // ✅ Conversation avatar
//       if (conv.getAvatarUrl) {
//         const updated = await conv.getAvatarUrl();
//         if (updated) conv.avatar = updated;
//       }

//       //  Members avatar
//       for (const member of conv.members) {
//         if (member.user?.getAvatarUrl) {
//           const updated = await member.user.getAvatarUrl();
//           if (updated) member.user.avatar = updated;
//         }
//       }

//       //  Last message sender avatar
//       if (conv.last_message?.sender?.getAvatarUrl) {
//         const updated = await conv.last_message.sender.getAvatarUrl();
//         if (updated) conv.last_message.sender.avatar = updated;
//       }
//     }

//     // 3) JSON objesine çevir
//     conversations = conversations.map((c) => c.toObject());

//     // 4) Unread hesapla
//     await Promise.all(
//       conversations.map(async (c) => {
//         const meMember = c.members.find(
//           (m) => String(m.user?._id || m.user) === String(me)
//         );
//         const lastReadId = meMember?.lastReadMessageId || null;

//         const query = { conversation: c._id, sender: { $ne: me } };
//         if (lastReadId) query._id = { $gt: lastReadId };

//         const unread = await Message.countDocuments(query);
//         c.unread = unread; // artık JSON obje → eklenir
//       })
//     );

//     res.json({ success: true, conversations });
//   } catch (err) {
//     console.error("GET /conversation/:userId error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// POST 

router.get("/:userId", async (req, res) => {
  try {
    const me = new mongoose.Types.ObjectId(req.params.userId);

    // 1️⃣ Konuşmaları getir
    let conversations = await Conversation.find({ "members.user": me })
      .sort({ updatedAt: -1 })
      .populate("last_message.sender", "username avatar")
      .populate("members.user", "username phone avatar status about")
      .populate("last_message.message", "")
      .populate("createdBy", "")
      .populate("active_call", "")
      .exec();

    // 2️⃣ Avatarları yenile (görsellerin URL süresi dolmuşsa)
    for (const conv of conversations) {
      if (conv.getAvatarUrl) {
        const updated = await conv.getAvatarUrl();
        if (updated) conv.avatar = updated;
      }

      for (const member of conv.members) {
        if (member.user?.getAvatarUrl) {
          const updated = await member.user.getAvatarUrl();
          if (updated) member.user.avatar = updated;
        }
      }

      if (conv.last_message?.sender?.getAvatarUrl) {
        const updated = await conv.last_message.sender.getAvatarUrl();
        if (updated) conv.last_message.sender.avatar = updated;
      }
    }

    // 3️⃣ JSON’a dönüştür ve sadece aktif kullanıcıya özel unread değeri ekle
    const result = conversations.map((conv) => {
      const c = conv.toObject();
      const meMember = c.members.find(
        (m) => String(m.user?._id || m.user) === String(me)
      );
      c.myUnread = meMember?.unread ?? 0;
      return c;
    });

    // 4️⃣ Gönder
    res.json({ success: true, conversations: result });
  } catch (err) {
    console.error("GET /conversation/:userId error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/add-members", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, addMembers } = req.body; // userId = işlemi yapan kişi

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Geçersiz grup ID" });
    }

    if (!Array.isArray(addMembers) || addMembers.length === 0) {
      return res.status(400).json({ success: false, message: "Eklenecek kullanıcı listesi boş" });
    }

    const conversation = await Conversation.findById(id)
      .populate("members.user", "username avatar")
      .populate("createdBy", "username");

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Grup bulunamadı" });
    }

    // 🛡️ Yetki kontrolü: sadece admin (createdBy) ekleyebilir
    if (String(conversation.createdBy._id) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Yetkisiz işlem" });
    }

    // 🧠 Eklenecek kullanıcıları getir
    const users = await User.find({ _id: { $in: addMembers } });

    // 🔁 Zaten grupta olanları filtrele
    const newMembers = users.filter(
      (u) => !conversation.members.some((m) => String(m.user._id) === String(u._id))
    );

    if (!newMembers.length) {
      return res.status(400).json({ success: false, message: "Tüm kullanıcılar zaten grupta" });
    }

    // 🏗️ Yeni üyeleri ekle
    const membersToPush = newMembers.map((u) => ({
      user: u._id,
      role: "member",
      joinedAt: new Date(),
    }));

    await Conversation.updateOne(
      { _id: id },
      { $push: { members: { $each: membersToPush } }, $set: { updated_at: new Date() } }
    );

    // 🔄 Güncellenmiş halini al
    const updated = await Conversation.findById(id)
      .populate("members.user", "username avatar phone about")
      .populate("createdBy", "username");

    return res.json({
      success: true,
      message: `${newMembers.length} üye eklendi.`,
      conversation: updated,
    });
  } catch (err) {
    console.error("❌ POST /conversation/:id/add-members", err);
    res.status(500).json({ success: false, message: "Sunucu hatası", error: err.message });
  }
});


router.post("/private", async (req, res) => {
  try {
    const { userId, otherUserId } = req.body;

    if (!userId || !otherUserId) {
      return res.status(400).json({ success: false, message: "Eksik bilgi" });
    }

    // Önceden var mı kontrol et
    let conversation = await Conversation.findOne({
      type: "private",
      "members.user": { $all: [userId, otherUserId] },
      $expr: { $eq: [{ $size: "$members" }, 2] },
    });

    // Yoksa oluştur
    if (!conversation) {
      conversation = await Conversation.create({
        type: "private",
        members: [
          { user: userId },
          { user: otherUserId },
        ],
      });
    }

    await conversation.populate("members.user", "username avatar");

    res.json({ success: true, conversation });
  } catch (err) {
    console.error("❌ private chat error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

router.post("/group", async (req, res) => {
  try {
    const { userId, name, members, avatarKey, createdBy } = req.body;
    
    if (!userId || !name || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Eksik bilgi: userId, name, members gerekli."
      });
    }

    // Tekrarlı üyeleri engelle
    const uniqueMembers = [...new Set([...members, userId])];

    // ✅ avatar alanı obje olmalı
    const avatarObj = avatarKey
      ? { key: avatarKey, url: "", url_expiresAt: null }
      : { key: "", url: "", url_expiresAt: null };

    // ✅ conversation oluştur
    let conversation = await Conversation.create({
      type: "group",
      name,
      avatar: avatarObj,
      members: uniqueMembers.map((id) => ({
        user: id,
        role: id === userId ? "admin" : "member",
      })),
      createdBy,
    });

    // ✅ Avatar URL güncelle (eğer key varsa)
    if (conversation.avatar?.key) {
      conversation.avatar = await conversation.getAvatarUrl();
    }


    // ✅ Birden fazla conversation için refresh method'u Model üzerinden çağırılır
    const [refreshedConv] = await Conversation.refreshAvatars([conversation]);
        // ✅ populate işlemleri
    await refreshedConv.populate("members.user", "username avatar createdBy");
    await refreshedConv.populate("createdBy", "username");

    res.status(201).json({
      success: true,
      conversation: refreshedConv,
    });
  } catch (err) {
    console.error("❌ group chat error:", err);
    res.status(500).json({
      success: false,
      message: "Sunucu hatası",
      error: err.message,
    });
  }
});

// router.post("/message", async (req, res) => {
//   try {
//     let { conversation, sender, type, text, media_key, mimetype, size, media_duration, call_info } = req.body;
//     if (!conversation || !sender) return res.status(400).json({ error: "Eksik alan" });
//     //console.log("data: ",{ conversation, sender, type, text, media_key, mimetype, size, media_duration, call_info })
//     // uyumluluk: eski client "media" yollarsa gerçek türe çevir
    
//     console.log({ conversation, sender, type, text, media_key, mimetype, size, media_duration, call_info })
//     // güvenlik: text vs media boşluk kontrolü
//     if (type === "text" && !text) return res.status(400).json({ error: "Text boş" });
//     if (["image","video","file"].includes(type) && !media_key)
//       return res.status(400).json({ error: "media_key eksik" });

//     const message = await Message.create({
//       conversation, sender, type, text,
//       media_key, mimetype, size, media_duration,
//       call_info,readBy:[{user:sender}],deliveredTo:[{user:sender}]
//     });

//     if(message.media_key){
//       await message.getMediaUrl();
//     }
    
//     const chat = await Conversation.findByIdAndUpdate(
//       conversation,
//       {
//         $set: {
//           "last_message.message": message._id,
//           "last_message.type": type,
//           "last_message.sender": sender,
//           updated_at:message.createdAt
//         },
//       },
//       { new: true }
//     ).sort({ updated_at: -1 }).populate({ path: "last_message.sender", select: "username" })
//       .populate("members.user", "username phone avatar status about")
//       .populate("last_message.message","")
//       .populate("createdBy", "username");
      
    
    
//     res.status(201).json({ success: true, message , chat});
//   } catch (e) {
//     console.log("sunucu hatası: ",e.message);
//     res.status(500).json({ error: "Sunucu hatası" });
//   }
// });

router.post("/message", async (req, res) => {
  try {
    const { conversation, sender, type, text, media_key, mimetype, size, media_duration, call_info } = req.body;

    if (!conversation || !sender)
      return res.status(400).json({ error: "Eksik alan" });

    if (type === "text" && !text)
      return res.status(400).json({ error: "Text boş" });

    if (["image", "video", "file"].includes(type) && !media_key)
      return res.status(400).json({ error: "media_key eksik" });

    // 📨 Mesaj oluştur
    const message = await Message.create({
      conversation,
      sender,
      type,
      text,
      media_key,
      mimetype,
      size,
      media_duration,
      call_info,
      readBy: [{ user: sender }],
      deliveredTo: [{ user: sender }],
    });

    // 🎞️ Medya varsa URL oluştur
    if (message.media_key) await message.getMediaUrl();

    // 🕓 Son mesajı güncelle
    await Conversation.updateOne(
      { _id: conversation },
      {
        $set: {
          "last_message.message": message._id,
          "last_message.text": text || "",
          "last_message.type": type,
          "last_message.sender": sender,
          "last_message.sent_at": new Date(),
          updated_at: message.createdAt,
        },
      }
    );

    // ⚡️ unread’i artır (gönderen hariç)
    await Conversation.updateOne(
      { _id: conversation },
      { $inc: { "members.$[elem].unread": 1 } },
      {
        arrayFilters: [{ "elem.user": { $ne: sender } }],
      }
    );

    // 🔄 Güncel hali al
    const updatedChat = await Conversation.findById(conversation)
      .populate("last_message.sender", "username avatar")
      .populate("members.user", "username phone avatar status about")
      .populate("last_message.message", "")
      .populate("createdBy", "username");

    res.status(201).json({ success: true, message, chat: updatedChat });
  } catch (e) {
    console.error("sunucu hatası:", e.message);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});


router.post("/", async (req, res) => {
  try {
    const { type, name, avatar, members } = req.body;

    if (!type || !members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ error: "type ve members alanları zorunludur." });
    }

    if (type === "private" && members.length !== 2) {
      return res.status(400).json({ error: "private tip sohbet için 2 üye olmalı." });
    }

    // Opsiyonel: members içindeki user_id'lerin geçerli ObjectId olup olmadığını kontrol edebilirsin.

    const newConversation = new Conversation({
      type,
      name: name || "",
      avatar: avatar || "",
      members
    });

    await newConversation.save();

    res.status(201).json(newConversation);
  } catch (error) {
    console.error("Sohbet oluşturma hatası:", error);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});



// PATCH

router.patch("/:id/avatar", async (req, res) => {
  try {
    const { id } = req.params;
    const { avatarKey } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Geçersiz conversation id" });
    }

    if (!avatarKey || typeof avatarKey !== "string") {
      return res.status(400).json({ success: false, message: "avatarKey gerekli" });
    }

    // Avatarı güncelle
    const updated = await Conversation.findByIdAndUpdate(
      id,
      {
        $set: {
          "avatar.key": avatarKey.trim(),
          "avatar.url": "",
          "avatar.url_expiresAt": null,
          updated_at: new Date(),
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Konuşma bulunamadı" });
    }

    // ✅ Güncel URL üret (presigned)
    const avatarUrl = await updated.getAvatarUrl();

    res.json({
      success: true,
      conversation: {
        _id: updated._id,
        name: updated.name,
        type: updated.type,
        avatar: { url: avatarUrl },
        updated_at: updated.updated_at,
      },
    });
  } catch (err) {
    console.error("PATCH /conversations/:id/avatar error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası: "+err});
  }
});


router.patch("/message/mark-delivered", async (req, res) => {
  try {
    const { by, since } = req.body;
    if (!by) return res.status(400).json({ error: "`by` (userId) zorunlu" });

    // 1) tip güvenliği
    const byId = ObjectId.isValid(by) ? new ObjectId(by) : null;
    if (!byId) return res.status(400).json({ error: "`by` geçersiz ObjectId" });

    const startDate = since ? new Date(since) : new Date(0);
    if (isNaN(startDate)) {
      return res.status(400).json({ error: "`since` geçersiz tarih" });
    }

    // 2) aday mesajları bul (bu user göndermemiş, since'ten yeni)
    // deliveredTo.user içinde zaten varsa getirmeyelim
    const toUpdate = await Message.find({
      sender: { $ne: byId },
      createdAt: { $gt: startDate },
      "deliveredTo.user": { $ne: byId },
    })
      .select("_id conversation")
      .lean();

    if (!toUpdate.length) {
      return res.json({ success: true, modified: 0, modifiedDocs: [] });
    }

    const ids = toUpdate.map((m) => m._id);
    const now = new Date();

    // 3) TEKİL EKLEME: sadece { user: byId } ekle
    await Message.updateMany(
      { _id: { $in: ids } },
      { $addToSet: { deliveredTo: { user: byId } } }
    );

    // 4) ZAMAN GÜNCELLEME: ekli elemana .at = now
    await Message.updateMany(
      { _id: { $in: ids }, "deliveredTo.user": byId },
      { $set: { "deliveredTo.$[e].at": now } },
      { arrayFilters: [{ "e.user": byId }] }
    );

    const modifiedDocs = toUpdate.map((m) => ({
      id: String(m._id),
      conversation: String(m.conversation),
    }));

    return res.json({
      success: true,
      modified: ids.length,
      modifiedDocs,
    });
  } catch (e) {
    console.error("PATCH /conversation/message/mark-delivered", e);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.patch("/message/status", async (req, res) => {
  try {
    const { ids = [], action, by, convId } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids boş olamaz" });
    }
    if (!by) return res.status(400).json({ error: "`by` (userId) zorunlu" });
    if (!["delivered", "read"].includes(action)) {
      return res.status(400).json({ error: "Geçersiz action" });
    }

    const now = new Date();

    // ✅ 1️⃣ Teslim Edildi
    if (action === "delivered") {
      const r = await Message.updateMany(
        { _id: { $in: ids }, "deliveredTo.user": { $ne: by } },
        { $push: { deliveredTo: { user: by, at: now } } }
      );

      return res.json({
        success: true,
        action,
        by,
        modified: r.modifiedCount ?? r.nModified ?? 0,
      });
    }

    // ✅ 2️⃣ Okundu (read)
    if (action === "read") {
      // readBy ve deliveredTo listelerine ekle
      const result = await Message.bulkWrite([
        {
          updateMany: {
            filter: { _id: { $in: ids }, "readBy.user": { $ne: by } },
            update: { $push: { readBy: { user: by, at: now } } },
          },
        },
        {
          updateMany: {
            filter: { _id: { $in: ids }, "deliveredTo.user": { $ne: by } },
            update: { $push: { deliveredTo: { user: by, at: now } } },
          },
        },
      ]);

      // En son okunan mesajı bul
      const lastMessage = await Message.findOne({ _id: { $in: ids } }).sort({
        _id: -1,
      });

      // ✅ Kullanıcının lastReadMessageId ve unread bilgilerini güncelle
      await Conversation.updateOne(
        { _id: convId, "members.user": by },
        {
          $set: {
            "members.$.lastReadMessageId": lastMessage?._id || null,
            "members.$.lastReadAt": now,
            "members.$.unread": 0, // 🔥 unread sıfırla
          },
        }
      );

      // (Opsiyonel) İstersen diğer üyelerin unread'lerini koru

      // kaba bir modified hesabı
      const modified =
        (result?.result?.nModified ?? result?.modifiedCount ?? 0);

      return res.json({ success: true, action, by, modified });
    }
  } catch (e) {
    console.error("PATCH /conversation/message/status", e.message);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});


// router.patch('/user/last_seen/:id', async (req,res) => {
//   const {id} = req.params;
//   try{
//     const setLast_Seen = await User.findByIdAndUpdate({_id:id},{$set:{last_seen:Date.now()}})
//     res.json({success:true,last_seen:setLast_Seen.last_seen})
//   }catch(err){
//     console.error("PATCH /user/last_seen/:id", err);
//     res.status(500).json({ error: "Sunucu hatası" });
//   }
// })

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, name, avatarKey } = req.body;

    // Sohbeti bul
    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Sohbet bulunamadı" });
    }

    // Grup mu kontrol et
    if (conversation.type !== "group") {
      return res.status(400).json({ success: false, message: "Sadece grup sohbeti güncellenebilir" });
    }

    // Yalnızca kurucu güncelleyebilsin
    if (String(conversation.createdBy) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Yetkisiz işlem" });
    }

    // Güncellemeler
    if (name) {
      conversation.name = name;
    }

    if (avatarKey) {
      conversation.avatar = {
        key: avatarKey,
        url: "",
        url_expiresAt: null,
      };
      await conversation.getAvatarUrl(); // presigned URL güncelle
    }

    await conversation.save();
    await conversation.populate("members.user", "username avatar");
    await conversation.populate("createdBy", "username");

    res.json({ success: true, conversation });
  } catch (err) {
    console.error("conversation update error:", err.message);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

export default router;
