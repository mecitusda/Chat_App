import {createServer} from "http";
import express from "express";   // Express'i ekle
import {Server} from "socket.io";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const PORT = process.env.SOCKET_PORT || 3500;
const BACKEND_URL = process.env.BACKEND_URL;
const app = express();
const server = createServer(app);

const TYPING_TTL_MS = 6000; // 6 sn sonra otomatik "durdu" varsay

//status
const socketsByUser = new Map(); // userId -> Set<socketId>
const lastSeenByUser = new Map(); // userId -> timestamp (ms) - İleride docker ve redis kullanılarak set edilecek.

const getLastSeens = async () => {
  setTimeout(async()=> {
  await axios.get(`${BACKEND_URL}/api/conversation/last-seen`).then((response)=>{
    Object.entries(response.data.lastSeen).forEach(([userId,isoDate])=>{
       const timestamp = new Date(isoDate).getTime();
  if (!isNaN(timestamp)) {
    lastSeenByUser.set(userId, timestamp);
  } else {
    console.warn(`Invalid date for user ${userId}: ${isoDate}`);
  }
    })
  })
  console.log("son görülme güncellendi.")
  },1000)
}

getLastSeens();
//typing
const typingTimers = new Map();

// Helpers
function emitPresence(userId, online) {
  const payload = { userId, online, lastSeen: online ? undefined : lastSeenByUser.get(userId) || Date.now() };
  io.to(`presence:user:${userId}`).emit("presence:update", payload);
}

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



const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"], // Geliştirme için, prod’da domain belirt
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
  if (!socketsByUser.has(currentUserId)) socketsByUser.set(currentUserId, new Set());
  socketsByUser.get(currentUserId).add(socket.id);
  socket.join(`user:${currentUserId}`);
  console.log("kullanıcı odaya katıldı: ",`user:${currentUserId}`,last_seen)
  emitPresence(currentUserId, true);

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
      const kind = type?.startsWith("image/") ?"image"
                : type?.startsWith("video/") ?"video"
                : type?.startsWith("application/") ?"file"
                  :"text";
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
          type:kind,
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
        message:"mesaj gönderildi."
      });
      console.log("güncellenmiş chat: ",data?.chat)
      const responsemembers = await axios.get(`${BACKEND_URL}/api/conversation/${conversationId}/members`)
      for (const m of responsemembers.data?.members) {
        io.to(`user:${m}`).emit("chatList:update", 
          data?.chat
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
    console.log("limit: ",limit)
    const url = `${BACKEND_URL}/api/conversation/messages/${conversationId}?before=${before}&limit=${limit || 50}`;
    const {data} = await axios.get(url);
    socket.emit("messageList", {conversationId,...data,message:"before"}); // tek event
  } catch (err) {
    console.error("messages-before error:", err?.message);
    socket.emit("error", "Eski mesajlar alınamadı");
  }
});

  socket.on("pre-signature-file",async ({mediaKeys,conversationId}) => {
    try{
      const response = await axios.post(`${BACKEND_URL}/api/file/presigned-url/files`,{
       mediaKeys
      })
      
      const urls = response.data;
      socket.emit("pre-urls",{urls,conversationId})
    }catch (err) {
      console.error("messages error:", err);
      socket.emit("error", "pre-signature alınamadı");
    }
  })

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

  socket.on("presence:subscribe", ({ userIds = [] } = {}) => {
    for (const uid of userIds) socket.join(`presence:user:${String(uid)}`);
  });

  // İstemci “artık izlemiyorum” der
  socket.on("presence:unsubscribe", ({ userIds = [] } = {}) => {
    for (const uid of userIds) socket.leave(`presence:user:${String(uid)}`);
  });

  // İstemci “şu kullanıcıların anlık durumunu” sorar
  socket.on("presence:who", ({ userIds = [] } = {}, cb) => {
    const res = {};
    for (const uid0 of userIds) {
      const uid = String(uid0);
      const online = socketsByUser.get(uid)?.size > 0;
      res[uid] = { online, lastSeen: online ? undefined : (lastSeenByUser.get(uid) || null) };
    }
    cb?.(res);
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



  socket.on("disconnect",async () => {
    if (!currentUserId) return;
    const set = socketsByUser.get(currentUserId);
    if (!set) return;
    set.delete(socket.id);
    if (set.size === 0) {
      socketsByUser.delete(currentUserId);
      lastSeenByUser.set(currentUserId, Date.now());
      emitPresence(currentUserId, false);
    }
    await axios.patch(`${BACKEND_URL}/api/conversation/user/last_seen/${currentUserId}`)
  });
});

server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});
