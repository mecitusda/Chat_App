import express from "express";
import s3 from "../config/s3.js"; // senin config dosyan
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";
import Message from "../models/Message.js"
import Conversation from "../models/Conversation.js";
import User from "../models/Users.js"
import { getSignedUrlFromStorage } from "../utils/storage.js";
dotenv.config();
const router = express.Router();


function generateUniqueFilename() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  // Basit benzersiz ID: rastgele 6 haneli hex sayı
  const uniqueId = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");

  return `${year}-${month}-${day} saat ${hours}.${minutes}.${seconds}_${uniqueId}`;
}



const fType = (data) => {
 return  data.startsWith("image/")
  ? "images"
  : data.startsWith("video/")
  ? "videos"
  : data.startsWith("audio/")
  ? "audios"
  : "files";
}


router.get("/presigned-url/profile", async (req, res) => {
  try {
    const { user_id , fileType } = req.query;
    //console.log({ user_id , fileType })
    if (!user_id || !fileType) {
      return res.status(400).json({ error: "Eksik parametre" });
    }

    const key = `profile-images/${user_id}/${fType(fileType)}/${generateUniqueFilename()}.${fileType.split("/")[1]}`;
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });
    const uploadURL = await getSignedUrl(s3, command, { expiresIn: 60 }); // 60 saniye geçerli
    

    return res.json({ uploadURL, media_key:key });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "URL alınamadı" });
  }
});

router.get("/presigned-url/group", async (req, res) => {
   try {
    const { fileType } = req.query; // ör: "image/png"
    if (!fileType) {
      return res.status(400).json({ success: false, message: "Dosya tipi gerekli" });
    }

    const key = `avatars/${fType(fileType)}/${generateUniqueFilename()}.${fileType.split("/")[1]}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });
  
    const uploadURL = await getSignedUrl(s3, command, { expiresIn: 60 }); // 60 saniye geçerli

    res.json({
      success: true,
      uploadUrl: uploadURL, // 👈 dosyayı PUT ile buraya yükle
      key,            // 👈 DB’de saklanacak
    });
  } catch (err) {
    console.error("presigned avatar error:", err.message);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

router.get("/presigned-url/message", async (req, res) => {
  try {
    const { conversationId, fileType } = req.query;
    
    if (!conversationId || !fileType) {
      return res.status(400).json({ error: "Eksik parametre" });
    }
    const key = `conversations/${conversationId}/${fType(fileType)}/${generateUniqueFilename()}.${fileType.split("/")[1]}`;
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });
    const uploadURL = await getSignedUrl(s3, command, { expiresIn: 60 }); // 60 saniye geçerli
    const mediaKey = key;

    return res.json({ uploadURL, mediaKey });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "URL alınamadı" });
  }
});


router.get("/presigned-url/file", async (req, res) => {//bu routera yetki koyucazki herkes alamasın signature.hepsine koyulcak ama bu öncelikli
  
  const mediaKey = req.query.mediaKey;
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `${mediaKey}`,
  });
  try{
     const url = await getSignedUrl(s3, command, { expiresIn: 86400 }); // 1 saat geçerli
  return res.json({ url });
  }catch(error){
    console.error(error);
    return res.status(500).json({ error: "URL alınamadı" });
  }
});

router.get("/presigned-url/background", async (req, res) => {
  const { userId, fileType } = req.query;
  if (!userId || !fileType) {
    return res.status(400).json({ error: "userId ve fileType zorunlu" });
  }

  const ext = fileType.split("/")[1];
  const mediaKey = `backgrounds/${userId}-${Date.now()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: mediaKey,
    ContentType: fileType,
  });

  try {
    const uploadURL = await getSignedUrl(s3, command, { expiresIn: 60 * 5  }); // 5 dakika geçerli
    //console.log("girdi döndü: ",{ uploadURL, mediaKey })
    res.json({ uploadURL, mediaKey });
  } catch (err) {
    console.error("Presigned URL hatası:", err);
    res.status(500).json({ error: "Presigned URL oluşturulamadı" });
  }
});

// POST 



router.post("/presigned-url/avatars", async (req, res) => {
  try {
    const { expiredAvatars } = req.body; // [{conversationId, type}, {userId, conversationId, type}]
    const results = [];
    console.log(expiredAvatars)
    for (const item of expiredAvatars) {
      if (item.type === "conversation") {
        const conv = await Conversation.findById(item.conversationId).select("avatar");
        if (conv?.avatar?.key) {
          const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: conv.avatar.key,
          });
          const url = await getSignedUrl(s3, command, { expiresIn: 86400});
          results.push({
            type: "conversation",
            conversationId: item.conversationId,
            avatar: { url, url_expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
          });
        }
      }

      if (item.type === "user") {
        const u = await User.findById(item.userId).select("avatar");
        if (u?.avatar?.key) {
          const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: u.avatar.key,
          });
          const url = await getSignedUrl(s3, command, { expiresIn: 86400 });
          results.push({
            type: "user",
            conversationId: item.conversationId,
            userId: item.userId,
            avatar: { url, url_expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
          });
        }
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error("❌ /presigned-url/avatars error:", err);
    res.status(500).json({ success: false, error: "Avatar presigned alınamadı" });
  }
});

// router.post("/presigned-url/bgImages", async (req, res) => {
//   const { backgrounds } = req.body; 
//   if (!Array.isArray(backgrounds) || backgrounds.length === 0) {
//     return res.status(400).json({ error: "backgrounds boş olamaz" });
//   }

//   try {
//     const urls = await Promise.all(
//       backgrounds.map(async (bg) => {
//         const command = new GetObjectCommand({
//           Bucket: process.env.AWS_BUCKET_NAME,
//           Key: bg.media_key,
//         });
//         const url = await getSignedUrl(s3, command, { expiresIn: 86400 });

//         return {
//           ...bg,
//           media_url: url,
//         };
//       })
//     );

//     return res.json(urls);
//   } catch (error) {
//     console.error("bgImage presigned hatası:", error);
//     return res.status(500).json({ error: "bgImage URL'leri alınamadı" });
//   }
// });



router.post("/presigned-url/files", async (req, res) => {
  const { messageIds } = req.body;
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ error: "messageIds gerekli" });
  }
  console.log("messageıds: ",messageIds)
  try {
    // 1) DB'den mesajları bul
    const messages = await Message.find({ _id: { $in: messageIds } });

    // 2) Presigned URL üret
    const urls = await Promise.all(
      messages.map(async (msg) => {
        if (!msg.media_key) {
          return { messageId: msg._id, media_url: null };
        }

        const command = new GetObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: msg.media_key,
        });

        const url = await getSignedUrl(s3, command, { expiresIn: 86400 }); // 10 dk

        // 3) DB'yi güncelle (isteğe bağlı)
        msg.media_url = url;
        msg.media_url_expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await msg.save();

        return { messageId: msg._id, media_url: url };
      })
    );

    return res.json(urls);
  } catch (error) {
    console.error("presigned-url/files error:", error);
    return res.status(500).json({ error: "URL alınamadı" });
  }
});




export default router;
