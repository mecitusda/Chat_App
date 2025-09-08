// src/slices/messageSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // byConversation: { [conversationId]: [msg, msg, ...] }
  byConversation: {},
};

const messageSlice = createSlice({
  name: "messages",
  initialState,
  reducers: {
    // Zaten vardı: upsert/merge (append/prepend yönüne göre)
    addOrUpdateMessages(state, action) {
      const { conversationId, messages, direction = "append" } = action.payload;
      if (!state.byConversation[conversationId]) state.byConversation[conversationId] = [];
      const list = state.byConversation[conversationId];
      const indexById = new Map(list.map((m, i) => [m._id, i]));
      const upsert = (m) => {
        if (indexById.has(m._id)) {
          const idx = indexById.get(m._id);
          list[idx] = { ...list[idx], ...m }; // <-- dizi alanları da override olur
        } else {
          if (direction === "prepend") list.unshift(m);
          else list.push(m);
        }
      };
      messages.forEach(upsert);

      // kronolojik
      list.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return ta && tb ? ta - tb : (a._id > b._id ? 1 : -1);
      });
    },

    // ✅ Optimistic mesaj: sadece pushla (append)
    addOptimisticMessage(state, action) {
      const { conversationId, message } = action.payload;
      if (!state.byConversation[conversationId]) {
        state.byConversation[conversationId] = [];
      }
      state.byConversation[conversationId].push(message);
      //console.log("optimistiği eklendi : ",message)
      state.byConversation[conversationId].sort((a, b) =>
        a._id > b._id ? 1 : -1
      );
      
    },

    // ✅ ACK geldiğinde temp mesajı gerçek mesajla değiştir
    replaceTempMessage(state, action) {
      const { conversationId, tempId, message } = action.payload;
      const list = state.byConversation[conversationId] || [];
      const idx = list.findIndex((m) => m._id === tempId);
      if (idx !== -1) {
        //console.log("1,",tempId,message,list[idx]._id)
        list[idx] = message; // kalem gibi değiştir
        //console.log(list[idx])
      } else {
        // temp bulunamadıysa güvenlik için ekle
        list.push(message);
        list.sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (ta && tb) return ta - tb;
          // fallback: _id
          return a._id > b._id ? 1 : -1;
        });
      }
    },

    // ✅ Sadece statü güncelle (sending → failed vs.)
     applyMessageAck(state, action) {
      const { conversationId, messageIds = [], actionType, by, at } = action.payload;
      const list = state.byConversation[conversationId] || [];
      for (const id of messageIds) {
        const m = list.find(x => x._id === id);
        if (!m) continue;

        if (actionType === "delivered") {
          m.deliveredTo = m.deliveredTo || [];
          if (!m.deliveredTo.some(x => String(x.user) === String(by))) {
            m.deliveredTo.push({ user: by, at: at || new Date().toISOString() });
          }
        } else if (actionType === "read") {
          // read geldiğinde delivered da garanti olsun
          m.deliveredTo = m.deliveredTo || [];
          if (!m.deliveredTo.some(x => String(x.user) === String(by))) {
            m.deliveredTo.push({ user: by, at: at || new Date().toISOString() });
          }
          m.readBy = m.readBy || [];
          if (!m.readBy.some(x => String(x.user) === String(by))) {
            m.readBy.push({ user: by, at: at || new Date().toISOString() });
          }
        }
      }
    },

    // updateMessageReceipts(state, action) {
    //   const { conversationId, messageId, messageIds, userId, status } = action.payload;
    //   const list = state.byConversation[conversationId] || [];
    //   const apply = (id) => {
    //     const msg = list.find((m) => m._id === id);
    //     if (!msg) return;
    //     if (!msg.receipts || typeof msg.receipts !== "object") msg.receipts = {};
    //     msg.receipts[userId] = status;
    //   };
    //   if (Array.isArray(messageIds)) messageIds.forEach(apply);
    //   else if (messageId) apply(messageId);
    // },
    

    resetMessages(state) {
      state.byConversation = {};
    },
  },
});

export const {
  addOrUpdateMessages,
  applyMessageAck,
  addOptimisticMessage,
  replaceTempMessage,
  resetMessages
} = messageSlice.actions;

export default messageSlice.reducer;
