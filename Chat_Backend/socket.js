import {createServer} from "http";
import express from "express";   // Express'i ekle
import {Server} from "socket.io";
import dotenv from "dotenv";
import axios from "axios";
import Redis from "ioredis";
dotenv.config();

const redis = new Redis(process.env.REDIS_URL); 

// örn: redis://localhost:6379





const PORT = process.env.SOCKET_PORT || 3500;
const BACKEND_URL = process.env.BACKEND_URL;
const app = express();
const server = createServer(app);

const TYPING_TTL_MS = 6000; // 6 sn sonra otomatik "durdu" varsay


const typingTimers = new Map();



// küçük yardımcı
async function deliveredFromBatch({ batch, conversationId, viewerId }) {
  const arr = batch?.messages || batch || [];
  const toDeliver = arr
    .filter(m => String(m.sender?._id || m.sender) !== String(viewerId))
    .filter(m => !(m.deliveredTo || []).some(x => String(x.user) === String(viewerId)))
    .map(m => m._id);

  if (!toDeliver.length) return;

  await axios.patch(`${BACKEND_URL}/api/conversation/message/status`, {
    ids: toDeliver,
    action: "delivered",
    by: viewerId,
  });
  
  // Odaya yayınla (gönderene ikon değiştirtmek için)
  io.to(`conv:${conversationId}`).emit("message:status-update", {
    messageIds: toDeliver,
    conversationId,
    action: "delivered",
    by: viewerId,
    at: Date.now(),
  });
}

async function markUserOnline(userId, socketId) {
  // Bu kullanıcıya ait socket’leri Redis setinde tut
  await redis.sadd(`presence:sockets:${userId}`, socketId);
  await redis.set(`presence:online:${userId}`, "1", "EX", 30); // 30 sn TTL
  await redis.del(`lastSeen:${userId}`);

  // Broadcast
  io.to(`presence:user:${userId}`).emit("presence:update", {
    userId,
    online: true,
    lastSeen: null,
  });

  // TTL yenileme heartbeat (her 10sn bir)
  const intervalKey = `interval:${socketId}`;
  if (!global[intervalKey]) {
    global[intervalKey] = setInterval(async () => {
      const sockets = await redis.smembers(`presence:sockets:${userId}`);
      if (sockets.length > 0) {
        await redis.set(`presence:online:${userId}`, "1", "EX", 30);
      } else {
        clearInterval(global[intervalKey]);
        delete global[intervalKey];
      }
    }, 10000);
  }
}

async function markUserOffline(userId, socketId) {
  await redis.srem(`presence:sockets:${userId}`, socketId);
  const sockets = await redis.smembers(`presence:sockets:${userId}`);

  if (sockets.length === 0) {
    await redis.del(`presence:online:${userId}`);
    await redis.set(`lastSeen:${userId}`, Date.now());
    io.to(`presence:user:${userId}`).emit("presence:update", {
      userId,
      online: false,
      lastSeen: new Date(),
    });
  }
}

async function getLastSeen(userId) {
  const ts = await redis.get(`lastSeen:${userId}`);
  return ts ? Number(ts) : null;
}


const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173","https://qbh9xq6w-5173.euw.devtunnels.ms","http://localhost:5173"], // Geliştirme için, prod’da domain belirt
    methods: ["GET", "POST"],
    credentials: true,
  },
  maxHttpBufferSize: 1e8 // 100 MB
});


io.on("connection", (socket) => {   
  let currentUserId = null;
  

  socket.on("join", async ({userId,last_seen}) => {
  currentUserId = String(userId);
  socket.data.userId = String(userId || "");
  

  socket.join(`user:${currentUserId}`);
  await markUserOnline(currentUserId, socket.id);
  console.log("kullanıcı odaya katıldı: ",`user:${currentUserId}`,last_seen)

  try {

    // 2) DB'de bu user için sent → delivered patch et
    const { data } = await axios.patch(
      `${BACKEND_URL}/api/conversation/message/mark-delivered`,
      {
        by: currentUserId,
        since: last_seen,
      }
    );

     if (data?.modifiedDocs?.length) {
      const mapByConv = new Map();
      for (const { id, conversation } of data.modifiedDocs) {
        if (!mapByConv.has(conversation)) mapByConv.set(conversation, []);
        mapByConv.get(conversation).push(id);
      }
      for (const [convId, ids] of mapByConv.entries()) {
        io.to(`conv:${convId}`).emit("message:status-update", {
          conversationId: convId,
          messageIds: ids,
          action: "delivered",
          by: currentUserId,
          at: Date.now(),
        });
      }
      io.to(`user:${currentUserId}`).emit("message:status-update", {
      messageIds: data.modifiedDocs.map(d => d.id),
      conversationId: null, // reducer içinde aktif conv’a ya da tümlerine uygula
      action: "delivered",
      by: currentUserId,
      at: Date.now(),
    });
    }

    // 4) Chat listesini getir
    const response = await axios.get(
      `${BACKEND_URL}/api/conversation/${userId}`
    );
    
    const conversations = response.data;

    // 5) Chat listesini client’a gönder
    socket.emit("chatList", conversations);

    const { data: rq } = await axios.get(`${BACKEND_URL}/api/auth/friends/requests/${userId}`);
    socket.emit("friends:requests:list", { success: true, requests: rq.requests || [] });

    console.log(`${userId} joined, chat list + delivered patch sent.`);
  } catch (err) {
    console.error("join error:", err?.response?.data || err?.message);
    socket.emit("error", "Chat listesi alınamadı");
  }
});

  socket.on("watch-conversation", ({ conversationId }) => {
    if(!conversationId) return;
    socket.join(`conv:${conversationId}`);
    // joinRoom(socket, conversationId);
  });

  socket.on("typing", ({ conversationId, userId, isTyping }) => {
    if (!conversationId || !userId) return;

    const key = `${conversationId}:${userId}`;

    // önce herkese değil, sadece o konuşmadaki ÜYELERE yayınla
    // kendine gönderme (except)
    socket.to(`conv:${conversationId}`).emit("typing-update", {
      conversationId,
      userId,
      isTyping: !!isTyping,
      at: Date.now(),
    });

    // otomatik TTL
    clearTimeout(typingTimers.get(key));
    if (isTyping) {
      const t = setTimeout(() => {
        io.to(`conv:${conversationId}`).emit("typing-update", {
          conversationId,
          userId,
          isTyping: false,
          at: Date.now(),
        });
        typingTimers.delete(key);
      }, TYPING_TTL_MS);
      typingTimers.set(key, t);
    } else {
      typingTimers.delete(key);
    }
  });

  socket.on("send-message", async (payload, ack) => {
    try {
      const {
        conversationId,
        sender,
        type,             // "text" | "media"
        text,
        media_key,        // presign sonrası oluşan key
        mimetype,         // image/png, video/mp4 ...
        size,
        clientTempId,     // UI’daki temp id
      } = payload;
      // 1) DB’ye yaz (REST API’n)
      // örnek bir endpoint varsayıyorum:
      // POST /api/conversation/:id/message

      // console.log({
      //   conversationId,
      //   sender,
      //   type,             // "text" | "media"
      //   text,
      //   media_key,        // presign sonrası oluşan key
      //   mimetype,         // image/png, video/mp4 ...
      //   size,
      //   clientTempId,     // UI’daki temp id
      // })
      const { data } = await axios.post(
        `${BACKEND_URL}/api/conversation/message`,
        {
          conversation:conversationId,
          sender,
          type,
          text,
          media_key,
          mimetype,
          size,
        }
      );
      // data.message bekliyoruz:
      const serverMessage = data?.message || data; // senin API nasıl dönüyorsa

      // 2) ACK: gönderen tarafa tempId ile birlikte gerçek mesaj
      ack?.({
        success: true,
        status: "sent",
        clientTempId,
        message: serverMessage,
      });

      // 3) Broadcast: konuşmadaki diğer üyelere yeni mesajı yolla
      // tek event "messageList" ile client tarafındaki handler’ına uyuyor
      socket.to(`conv:${conversationId}`).emit("messageList", {
        success: true,
        messages: [serverMessage],
        conversationId, // client handler’ı kullanıyorsa ekle
        message:"send-message"
      });
      
      // console.log("güncellenmiş chat: ",data?.chat)
      const responsemembers = await axios.get(`${BACKEND_URL}/api/conversation/${conversationId}/members`)
      for (const m of responsemembers.data?.members) {
        io.to(`user:${m}`).emit("chatList:update", 
          {data:data?.chat,
          message:"send-message"}
        );
      }


      
    } catch (err) {

      console.error("send-message error:", err?.message || err);
      ack?.({ success: false, error: err?.message || "Send failed" });
    }
  });


  socket.on("messages", async ({conversationId,limit}) => {
    try {
      const {data} = await axios.get(`${BACKEND_URL}/api/conversation/messages/${conversationId}?limit=${limit || 50}&userId=${currentUserId}`);//header eklenince userId headerdan alınacak.
      //console.log("döndürülen data: ",{conversationId,...data})
      // Mesajları socket ile gönder
      socket.emit("messageList", {conversationId,...data,message:"mesajlar çekildi."});
    } catch (err) {
      console.error("messages error:", err);
      socket.emit("error", "Mesajlar alınamadı");
    }
  });

  socket.on("messages-after",async ({ conversationId, after, limit })=>{
    try{
      const {data} = await axios.get(`${BACKEND_URL}/api/conversation/messages/${conversationId}?limit=${limit || 50}&after=${after}&userId=${currentUserId}`)
      socket.emit("messageList", {conversationId,...data,message:"after"} );
      const viewerId = socket.data.userId || currentUserId;
    if (viewerId) {
      await deliveredFromBatch({
        batch: data,
        conversationId,
        viewerId,
      });
    }
    }catch(err){
       console.error("messages error:", err);
      socket.emit("error", "Mesajlar alınamadı");
    }
  });

  socket.on("messages-before", async ({ conversationId, before, limit }) => {
  try {
   
    const url = `${BACKEND_URL}/api/conversation/messages/${conversationId}?before=${before}&limit=${limit || 50}`;
    const {data} = await axios.get(url);
    socket.emit("messageList", {conversationId,...data,message:"before"}); // tek event
  } catch (err) {
    console.error("messages-before error:", err?.message);
    socket.emit("error", "Eski mesajlar alınamadı");
  }
});

  socket.on("pre-signature-files", async ({ messageIds, conversationId }) => {
  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/file/presigned-url/files`,
      { messageIds },
      // { headers: { Authorization: `Bearer ${authToken}` } } // 👈 yetki kontrolü eklenecek
    );

    const urls = response.data;

    socket.emit("pre-urls", { urls,conversationId });
  } catch (err) {
    console.error("messages error:", err);
    socket.emit("error", "pre-signature alınamadı");
  }
});

  socket.on("pre-signature-avatars",async ({mediaKeys}) => {
    
    try{
      const response = await axios.post(`${BACKEND_URL}/api/file/presigned-url/avatars`,{
       avatars:mediaKeys
      })
      
      const urls = response.data;
      console.log("mediaKey: ",mediaKeys)
      socket.emit("pre-avatars",urls)
    }catch (err) {
      console.error("messages error:", err);
      socket.emit("error", "pre-signature alınamadı");
    }
  })

  socket.on("refresh-conversation-avatars", async (expiredAvatars) => {
  try {
    // API’ye isteği yönlendir
    const { data } = await axios.post(
      `${process.env.BACKEND_URL}/api/file/presigned-url/avatars`,
      {expiredAvatars:expiredAvatars}
    );
    if (data.success) {
      socket.emit("conversation-avatars-updated", {updates:data.results});
    } else {
      socket.emit("error", "Avatar yenileme başarısız oldu");
    }
  } catch (err) {
    console.error("❌ refresh-conversation-avatars socket error:", err);
    socket.emit("error", "Avatar yenileme başarısız oldu");
  }
  });

 
  
  socket.on("message:delivered", async ({ messageId, conversationId, userId }) => {
  try {
    console.log("iletildi: ",{ messageId, conversationId, userId })
    await axios.patch(`${BACKEND_URL}/api/conversation/message/status`, {
      ids: [messageId],
      action: "delivered",
      by: userId,
    });
    io.to(`conv:${conversationId}`).emit("message:status-update", {
      messageIds: [messageId],
      conversationId,
      action: "delivered",
      by: userId,
      at: Date.now(),
    });
  } catch (err) {
    console.error("message:delivered error:", err?.response?.data || err?.message);
  }
  });

  socket.on("message:read", async ({ messageIds = [], conversationId, userId }) => {
  try {
    await axios.patch(`${BACKEND_URL}/api/conversation/message/status`, {
      ids: messageIds,
      action: "read",
      by: userId,
      convId:conversationId
    });
    io.to(`conv:${conversationId}`).emit("message:status-update", {
      messageIds,
      conversationId,
      action: "read",
      by: userId,
      at: Date.now(),
    });
  } catch (err) {
    console.error("message:read error:", err?.response?.data || err?.message);
  }
  });


  //friends

  socket.on("friends:requests:list", async ({ userId }) => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/auth/friends/requests/${userId}`);
      socket.emit("friends:requests:list", { success: true, requests: data.requests || [] });
    } catch (err) {
      console.error("friends:requests:list error:", err?.response?.data || err?.message);
      socket.emit("friends:requests:list", { success: false, requests: [], error: "istekler alınamadı" });
    }
  });

  socket.on("friends:list:get", async ({ userId }) => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/auth/friends/${userId}`);
      socket.emit("friends:list", { success: true, friends: data.friends || [] });
    } catch (err) {
      console.error("friends:list:get error:", err?.response?.data || err?.message);
      socket.emit("friends:list", { success: false, friends: [], error: "arkadaşlar alınamadı" });
    }
  });

  // Arkadaşlık isteği gönder (numarayla veya toUserId ile)
  socket.on("friends:send-request", async ({ fromUserId, phone }, ack) => {
    try {
      const { data } = await axios.post(`${BACKEND_URL}/api/auth/friends/request`, {
      fromUserId,
      phone,
      });

      if (!data.success) {
        ack?.({ success: false, message: data.message });
        return;
      }

      // 🔥 Karşılıklı istek varsa
      if (data.autoAccepted) {


      // İlk isteği atan kişiye: "2. atanı arkadaşına ekle"
      io.to(`user:${String(fromUserId)}`).emit("friends:added", {
        friend: data.toUserId,
      });

      // İkinci isteği atan kişiye: "ilk atanı arkadaşına ekle"
      io.to(`user:${String(data.toUserId)}`).emit("friends:added", {
        friend: data.fromUser,
      });

      ack?.({ success: true, message: "Arkadaş olarak eklendiniz 🤝" });
      } else {
      // 🔔 Normal istek → karşı tarafa bildir
      io.to(`user:${data.toUserId}`).emit("friends:request:incoming", {
        fromUser: data.fromUser,
      });

         ack?.({ success: true, message: data.message });
       }
     } catch (err) {
       console.error("friends:send-request error:", err?.response?.data || err?.message);
       ack?.({
      success: false,
      message: err?.response?.data?.message || "Sunucu hatası",
      });
    }
  });


  // İsteği kabul et
  socket.on("friends:accept", async ({ userId, fromUserId }, ack) => {
    try {
      const { data } = await axios.patch(
        `${BACKEND_URL}/api/auth/friends/accept`,
        { userId, fromUserId }
      );

      if (!data?.success) {
        ack?.({ success: false, message: data?.message || "Kabul edilemedi" });
        return;
      }

      // ✅ İsteği yapan (userId) → sadece ack
        ack?.({ success: true, message: "Arkadaş eklendi 🤝", friendId: fromUserId });

      // ✅ Karşı tarafa emit (isteği gönderen kullanıcıya)
      io.to(`user:${String(fromUserId)}`).emit("friends:request:accepted", {
        user: data.user,
      });

    } catch (err) {
      console.error("friends:accept error:", err?.response?.data || err?.message);
      ack?.({ success: false, message: "Sunucu hatası" });
    }
  });



  // İsteği reddet
  socket.on("friends:reject", async ({ userId, fromUserId }, ack) => {
    try { 
    const { data } = await axios.patch(
      `${BACKEND_URL}/api/auth/friends/reject`,
      { userId, fromUserId }
    );

      if (!data?.success) {
        ack?.({ success: false, message: data?.message || "Reddedilemedi" });
        return;
      }

      // ✅ İsteği yapan (userId) → sadece ack
      ack?.({ success: true, message: "Arkadaşlık isteği reddedildi 🚫", fromUserId });

      // ✅ Karşı tarafa emit (isteği gönderen kullanıcıya)
      io.to(`user:${String(fromUserId)}`).emit("friends:request:rejected", {
        username: data.toUsername,
      });

    } catch (err) {
      console.error("friends:reject error:", err?.response?.data || err?.message);
      ack?.({ success: false, message: "Sunucu hatası" });
    }
  });



  // Arkadaş silme
  socket.on("friends:remove", async ({ userId, friendId }, ack) => {
  try {
    const { data } = await axios.patch(
      `${BACKEND_URL}/api/auth/friends/remove`,
      { userId, friendId }
    );

    if (!data.success) {
      ack?.({ success: false, message: data.message });
      return;
    }

    // ✅ 1. İsteği yapan kişiye sadece ack dönüyoruz
    ack?.({ success: true, message: "Arkadaş silindi 🗑️", friendId });

    // ✅ 2. Karşı tarafa event gönderiyoruz
    io.to(`user:${String(friendId)}`).emit("friends:removed", { friendId: userId });

  } catch (err) {
    console.error("friends:remove error:", err?.response?.data || err?.message);
    ack?.({ success: false, message: "Sunucu hatası" });
  }
  });

  socket.on("conversation:create-group", async ({ userId, name, members, avatarKey, createdBy }, ack) => {
  try {
    // API'yi çağır
    const { data } = await axios.post(`${BACKEND_URL}/api/conversation/group`, {
      userId,
      name,
      members,
      avatarKey,
      createdBy
    });

    if (!data.success) {
      ack?.({ success: false, message: data.message });
      return;
    }

    // ✅ Tüm üyelere socket üzerinden bildir
    for (const m of data.conversation.members.map(mem => mem.user._id)) {
      socket.to(`user:${String(m)}`).emit("chatList:update", {
        data: data.conversation,
        message:`group-created`
      });
    }

    // ✅ İstek atan client’a ack dön
    ack?.({ success: true, conversation: data.conversation });
  } catch (err) {
    console.error("conversation:create-group error:", err?.response?.data || err.message);
    ack?.({ success: false, message: "Sunucu hatası" });
  }
  });

  socket.on("conversation:create-private", async ({ userId, friendId }, ack) => {
  try {
    const { data } = await axios.post(`${BACKEND_URL}/api/conversation/private`, {
      userId,
      otherUserId: friendId,
    });

    if (!data.success) {
      return ack?.({ success: false, message: data.message });
    }

    // ✅ Sohbeti sadece ack ile döndür
    ack?.({ success: true, conversation: data.conversation });
  } catch (err) {
    console.error("conversation:create-private error:", err?.message);
    ack?.({ success: false, message: "Sunucu hatası" });
  }
  });

  socket.on("conversation:update", async ({ conversationId, userId, name, avatarKey }, ack) => {
    try {
      // 1) API'yi çağır
      const { data } = await axios.patch(
        `${BACKEND_URL}/api/conversation/${conversationId}`,
        { userId, name, avatarKey }
      );

      if (!data.success) {
        ack?.({ success: false, message: data.message });
        return;
      }

      const updatedConv = data.conversation;
      console.log("updatedChat: ",updatedConv)
      // 2) Tüm üyelere yayınla (chat listelerini güncellemek için)
      for (const m of updatedConv.members.map(mem => mem.user._id)) {
        socket.to(`user:${String(m)}`).emit("chatList:update", {
          data: updatedConv,
          message: "conversation-updated",
        });
      }

      // 3) Başarılı ACK dön
      ack?.({ success: true, conversation: updatedConv });
    } catch (err) {
      console.error("conversation:update error:", err?.response?.data || err?.message);
      ack?.({ success: false, message: "Sunucu hatası" });
    }
  });

  // presence:subscribe
  socket.on("presence:subscribe", ({ userIds = [] } = {}) => {
    for (const uid of userIds) {
      socket.join(`presence:user:${String(uid)}`);
    }
  });

  // presence:unsubscribe
  socket.on("presence:unsubscribe", ({ userIds = [] } = {}) => {
    for (const uid of userIds) {
      socket.leave(`presence:user:${String(uid)}`);
    }
  });

  // presence:who
  socket.on("presence:who", async ({ userIds = [] } = {}, cb) => {
    const res = {};
    for (const uid0 of userIds) {
      const uid = String(uid0);

      const online = await redis.exists(`presence:online:${uid}`);
      let lastSeen = null;
      if (!online) {
        lastSeen = await redis.get(`lastSeen:${uid}`);
        if (lastSeen) lastSeen = new Date(Number(lastSeen));
      }
      res[uid] = { online: !!online, lastSeen };
    }
    cb?.(res);
  });



  socket.on("disconnect",async () => {
    if (!currentUserId) return;
    await markUserOffline(currentUserId, socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});
