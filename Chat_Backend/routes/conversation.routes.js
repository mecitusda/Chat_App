import express from "express";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/Users.js"
const router = express.Router();
import mongoose from "mongoose"
const { Types: { ObjectId } } = mongoose;

const rank = { sent: 1, delivered: 2, read: 3 };
function canUpgrade(current, next) {
  return (rank[next] || 0) > (rank[current] || 0);
}


// GET

router.get("/last-seen",async (req,res) => {
  try{
    const format = String(req.query.format || "iso").toLowerCase(); // "iso" | "ms"
    const users = await User.find({});
    const userMap = {};

    for (const d of users) {
      const t = d.last_seen ? new Date(d.last_seen) : null;
      userMap[String(d._id)] =
        t && !isNaN(t.getTime())
          ? format === "ms"
            ? t.getTime() // number (epoch ms)
            : t.toISOString() // string
          : null; // hiç last_seen yoksa
    }
    res.json({ success: true, count: userMap.length, lastSeen: userMap });
  }catch(err){
     console.error("GET /users/last-seen error:", err);
    res.status(500).json({ success: false, error: "Sunucu hatası" });
  }
});

router.get('/messages/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    let { limit, after, before, populate , userId } = req.query;
    const LIM = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    // 1) Query kur (cursor objesini güvenli kur)
    const query = { conversation: conversationId };
    const idCond = {};
    if (after && ObjectId.isValid(after))  idCond.$gt = new ObjectId(after);  // after → daha yeni
    if (before && ObjectId.isValid(before)) idCond.$lt = new ObjectId(before); // before → daha eski
    if (Object.keys(idCond).length) query._id = idCond;

    // 2) Sıralama stratejisi
    // after varsa ileri (kronolojik): _id:1
    // before varsa geri (eskiye doğru): _id:-1 (sonra UI için ters çeviririz)
    // ikisi de yoksa ilk sayfa: en yeniler → _id:-1 (sonra ters çevir)
    const sort =
      after ? { _id: 1 } :
      before ? { _id: -1 } :
      { _id: -1 };

    // 3) Probe için limit+1 çek
    let q = Message.find(query).sort(sort).limit(LIM + 1);
    if (populate && (populate === '1' || populate === 'true')) {
      q = q.populate("sender", "username avatar");
    }
    let docs = await q.lean();

    // 4) hasMore hesapla + fazlayı at
    const hasMoreRaw = docs.length > LIM;
    if (hasMoreRaw) docs = docs.slice(0, LIM);

    // 5) UI için kronolojik (eski→yeni) dönmek istiyorsak:
    const reverseNeeded = !after; // after zaten _id:1 ile kronolojik
    if (reverseNeeded) docs = docs.reverse();

    // 6) Cursorlar (mevcut batch’in uçları)
    const oldestId = docs.length ? String(docs[0]._id) : null;                   // batch'in en eskisi
    const newestId = docs.length ? String(docs[docs.length - 1]._id) : null;     // batch'in en yenisi

    // 7) Yönlü hasMore
    // - after modunda: daha da yeni var mı? (probe sonuç) → hasMoreAfter
    // - before/initial modunda: daha da eski var mı?       → hasMoreBefore
    const hasMoreBefore =
      (!after) ? hasMoreRaw : null; // initial/before çağrısında anlamlı
    const hasMoreAfter =
      (after) ? hasMoreRaw : null;  // after çağrısında anlamlı

    // 8) Sonraki cursor önerileri
    const nextAfter  = newestId; // /messages?after=nextAfter → daha yeniye devam
    const prevBefore = oldestId; // /messages?before=prevBefore → daha eskiye devam

    if(docs.length > 0 ){
      await Conversation.findOneAndUpdate(
  { _id: conversationId, "members.user": userId },
  {
    $set: {
      "members.$.lastReadMessageId": docs[docs.length-1]._id,
      "members.$.lastReadAt": new Date(),
    },
  }
);
    }

    res.json({
      success: true,
      messages: docs,
      pageInfo: {
        count: docs.length,
        limit: LIM,
        // çağrı parametreleri (debug için döndürüyoruz)
        after: after || null,
        before: before || null,
        // devam cursorları
        nextAfter,      // yeniye devam etmek için
        prevBefore,     // eskiye devam etmek için
        // yönlü bayraklar
        hasMoreBefore,
        hasMoreAfter
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Kullanıcının sohbetlerini listeleme

router.get("/:id/members", async (req, res) => {
  try {
    const { id } = req.params;
    const { exclude, populate } = req.query;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Geçersiz conversation id" });
    }
    if (exclude && !mongoose.isValidObjectId(exclude)) {
      return res.status(400).json({ error: "Geçersiz exclude user id" });
    }

    // Sadece üyeleri çekiyoruz; hızlı olsun diye lean + minimal select
    const conv = await Conversation.findById(id)
      .select("members.user")
      .lean();

    if (!conv) {
      return res.status(404).json({ error: "Konuşma bulunamadı" });
    }

    // (Opsiyonel güvenlik) İstek yapan kullanıcının gerçekten üye olduğunu doğrula.
    // Eğer auth kullanıyorsan req.user.id üzerinden kontrol edebilirsin.
    // if (!conv.members.some(m => String(m.user) === String(req.user.id))) {
    //   return res.status(403).json({ error: "Yetkisiz" });
    // }

    // Exclude’u at ve sadece user id’leri al
    const memberIds = conv.members
      .map(m => m.user)
      .filter(uid => !exclude || String(uid) !== String(exclude));

    // Populate isteniyorsa kullanıcıları çek
    if (populate === "1") {
      // ihtiyaç duyduğun alanları seç
      const users = await User.find({ _id: { $in: memberIds } })
        .select("_id username avatar")
        .lean();

      // memberIds sırasını korumak istersen:
      const map = new Map(users.map(u => [String(u._id), u]));
      const ordered = memberIds
        .map(id => map.get(String(id)))
        .filter(Boolean);

      return res.json({ success: true, members: ordered });
    }

    // Yalın id listesi
    return res.json({ success: true, members: memberIds.map(String) });
  } catch (err) {
    console.error("GET /conversation/:id/members", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});


router.get("/:userId", async (req, res) => {
  try {
    const me = new mongoose.Types.ObjectId(req.params.userId);

    // 1) Konuşmaları getir (senin mevcut populate'ların korunuyor)
    const conversations = await Conversation.find({
      "members.user": me
    })
      .sort({ updated_at: -1 })
      .populate({ path: "last_message.sender", select: "username avatar" })
      .populate("members.user", "username avatar status")
      .populate("last_message.message", "")
      .lean(); // ← sayım yaparken daha rahat

    // 2) Her konuşma için unread sayısını hesapla (kullanıcıya göre)
    await Promise.all(
      conversations.map(async (c) => {
        const meMember = (c.members || []).find(
          (m) => String(m.user?._id || m.user) === String(me)
        );
        
        const lastReadId = meMember?.lastReadMessageId || null;

        const query = {
          conversation: c._id,
          sender: { $ne: me },             // kendi gönderdiği okunmamış sayılmaz
        };
        if (lastReadId) {
          // son okunan mesajdan sonra gelenler
          query._id = { $gt: lastReadId };
        }

        const unread = await Message.countDocuments(query);
        c.unread = unread; // 👈 frontend bu alanı doğrudan kullanacak
      })
    );

    res.json({ success: true, conversations });
  } catch (err) {
    console.error("GET /conversation/:userId", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/messages/status/updated", async (req,res) => {
  try{

  }catch(err){
    console.error("path /messages/status/updated error: ",err.message)
    res.json({error:"sunucu hatası."})
  }
})

// POST 

// /routes/messages.js




router.post("/message", async (req, res) => {
  try {
    let { conversation, sender, type, text, media_key, mimetype, size, media_duration, call_info } = req.body;
    if (!conversation || !sender) return res.status(400).json({ error: "Eksik alan" });
    //console.log("data: ",{ conversation, sender, type, text, media_key, mimetype, size, media_duration, call_info })
    // uyumluluk: eski client "media" yollarsa gerçek türe çevir
    

    // güvenlik: text vs media boşluk kontrolü
    if (type === "text" && !text) return res.status(400).json({ error: "Text boş" });
    if (["image","video","file"].includes(type) && !media_key)
      return res.status(400).json({ error: "media_key eksik" });

    const message = await Message.create({
      conversation, sender, type, text,
      media_key, mimetype, size, media_duration,
      call_info,
    });
    
    const chat = await Conversation.findByIdAndUpdate(
      conversation,
      {
        $set: {
          "last_message.message": message._id,
          "last_message.type": type,
          "last_message.sender": sender,
          updated_at:message.createdAt
        },
      },
      { new: true }
    ).sort({ updated_at: -1 }).populate({ path: "last_message.sender", select: "username" })
      .populate("members.user", "username avatar status")
      .populate("last_message.message","");

      
    
    
    res.status(201).json({ success: true, message , chat});
  } catch (e) {
    console.log("sunucu hatası: ",e.message);
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
// router.patch("/conversation/message/mark-sent")
// routes/message.js

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



// router.patch("/message/:id/status", async (req, res) => {
//   try {
//     const { status, by } = req.body;
//     const { id } = req.params;

//     if (!["delivered", "read"].includes(status)) {
//       return res.status(400).json({ error: "Geçersiz status" });
//     }

//     const msg = await Message.findById(id);
//     if (!msg) return res.status(404).json({ error: "Mesaj bulunamadı" });

//     if (!canUpgrade(msg.status || "sent", status)) {
//       return res.json({ success: true, message: msg }); // no-op
//     }

//     msg.status = status;
//     await msg.save();

//     // Konuşmanın son mesajı ise last_message.status’i de yukarı çek
//     if (String(msg._id) === String(msg.conversation?.last_message?.message)) {
//       await Conversation.updateOne(
//         { _id: msg.conversation },
//         { $set: { "last_message.status": status } }
//       );
//     }

//     return res.json({ success: true, message: msg, by });
//   } catch (e) {
//     console.error("PATCH /message/:id/status", e);
//     res.status(500).json({ error: "Sunucu hatası" });
//   }
// });

// router.patch("/message/status", async (req, res) => {
//   console.log("333")
//   try {
//     const { ids = [], action, by } = req.body;
//     if (!Array.isArray(ids) || ids.length === 0) {
//       return res.status(400).json({ error: "ids boş olamaz" });
//     }
//     if (!by) return res.status(400).json({ error: "`by` (userId) gerekli" });
//     if (!["delivered", "read"].includes(action)) {
//       return res.status(400).json({ error: "action delivered|read olmalı" });
//     }

//     const now = new Date();

//     // Kendi gönderdiğin mesajlar için delivered/read yazma
//     const baseFilter = {
//       _id: { $in: ids },
//       sender: { $ne: by },
//     };

//     if (action === "delivered") {
//       const result = await Message.updateMany(
//         {
//           ...baseFilter,
//           "deliveredTo.user": { $ne: by },
//         },
//         {
//           $addToSet: { deliveredTo: { user: by, at: now } },
//         }
//       );
//       return res.json({
//         success: true,
//         modified: result.modifiedCount ?? result.nModified ?? 0,
//         action,
//         by,
//         modifiedIds: ids, // pratik: client'a geri verebiliriz
//       });
//     }

//     // action === "read"
//     const result = await Message.updateMany(
//       {
//         ...baseFilter,
//         "readBy.user": { $ne: by },
//       },
//       {
//         $addToSet: { readBy: { user: by, at: now } },
//         // read gelmişse delivered da garanti olsun
//         $setOnInsert: {},
//         $addToSet: { deliveredTo: { user: by, at: now } },
//       }
//     );

//     return res.json({
//       success: true,
//       modified: result.modifiedCount ?? result.nModified ?? 0,
//       action,
//       by,
//       modifiedIds: ids,
//     });
//   } catch (e) {
//     console.error("PATCH /message/status", e);
//     res.status(500).json({ error: "Sunucu hatası" });
//   }
// });


/**
 * Çoklu güncelleme: read/delivered
 * PATCH /api/message/status
 * body: { ids: [..], status: "read" | "delivered", by?: userId }
 */
// PATCH /api/conversation/message/status
// Body: { ids: [msgId...], action: "delivered" | "read", by: "<userId>" }

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

    if (action === "delivered") {
      // deliveredTo'ya yoksa ekle (idempotent)
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

    if (action === "read") {
      // readBy'ya yoksa ekle, deliveredTo'yu da garanti et
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

      const lastMessage = await Message.findOne({ _id: { $in: ids } })
  .sort({ _id: -1 }); // ObjectId sırasına göre en yeni
      console.log()
      await Conversation.updateOne(
  { _id: convId, "members.user": by },
  {
    $set: {
      "members.$.lastReadMessageId": lastMessage._id,
      "members.$.lastReadAt": now
    }
  }
);

      // kaba bir modified hesabı (yeterli)
      const modified =
        (result?.result?.nModified ??
          result?.modifiedCount ??
          0);

      return res.json({ success: true, action, by, modified });
    }
  } catch (e) {
    console.error("PATCH /conversation/message/status", e);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.patch('/user/last_seen/:id', async (req,res) => {
  const {id} = req.params;
  try{
    const setLast_Seen = await User.findByIdAndUpdate({_id:id},{$set:{last_seen:Date.now()}})
    res.json({success:true,last_seen:setLast_Seen.last_seen})
  }catch(err){
    console.error("PATCH /user/last_seen/:id", e);
    res.status(500).json({ error: "Sunucu hatası" });
  }
})
export default router;
