// // src/slices/messageSlice.js
// import { createSelector, createSlice } from "@reduxjs/toolkit";

// const initialState = {
//   // byConversation: { [conversationId]: [msg, msg, ...] }
//   byConversation: {},
// };

// const messageSlice = createSlice({
//   name: "messages",
//   initialState,
//   reducers: {
//     // Zaten vardı: upsert/merge (append/prepend yönüne göre)
//     addOrUpdateMessages(state, action) {
//       const { conversationId, messages, direction = "append" } = action.payload;
//       if (!state.byConversation[conversationId]) state.byConversation[conversationId] = [];
//       const list = state.byConversation[conversationId];
//       const indexById = new Map(list.map((m, i) => [m._id, i]));
//       const upsert = (m) => {
//         if (indexById.has(m._id)) {
//           const idx = indexById.get(m._id);
//           list[idx] = { ...list[idx], ...m }; // <-- dizi alanları da override olur
//         } else {
//           if (direction === "prepend") list.unshift(m);
//           else list.push(m);
//         }
//       };
//       messages.forEach(upsert);

//       // kronolojik
//       list.sort((a, b) => {
//         const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
//         const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
//         return ta && tb ? ta - tb : (a._id > b._id ? 1 : -1);
//       });
//     },

//     // ✅ Optimistic mesaj: sadece pushla (append)
//     addOptimisticMessage(state, action) {
//       const { conversationId, message } = action.payload;
//       if (!state.byConversation[conversationId]) {
//         state.byConversation[conversationId] = [];
//       }
//       state.byConversation[conversationId].push(message);
//       //console.log("optimistiği eklendi : ",message)
//       state.byConversation[conversationId].sort((a, b) =>
//         a._id > b._id ? 1 : -1
//       );
      
//     },

//     // ✅ ACK geldiğinde temp mesajı gerçek mesajla değiştir
//     replaceTempMessage(state, action) {
//       // const { conversationId, tempId, message } = action.payload;
//       // const list = state.byConversation[conversationId] || [];
//       // const idx = list.findIndex((m) => m._id === tempId);
//       // if (idx !== -1) {
//       //   //console.log("1,",tempId,message,list[idx]._id)
//       //   list[idx] = message; // kalem gibi değiştir
//       //   //console.log(list[idx])
//       // } else {
//       //   // temp bulunamadıysa güvenlik için ekle
//       //   list.push(message);
//       //   list.sort((a, b) => {
//       //     const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
//       //     const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
//       //     if (ta && tb) return ta - tb;
//       //     // fallback: _id
//       //     return a._id > b._id ? 1 : -1;
//       //   });
//       // }


//       const { conversationId, tempId, message } = action.payload;
//       const arr = state.byConversation[conversationId] || [];
    
//       // 1) temp'i at
//       let next = arr.filter(m => String(m._id) !== String(tempId));
    
//       // 2) aynı gerçek id zaten varsa onu da at
//       next = next.filter(m => String(m._id) !== String(message._id));
    
//       // 3) yeni mesajı ekle
//       next.push(message);
    
//       // (opsiyonel) tarihe göre sırala
//       next.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
    
//       state.byConversation[conversationId] = next;
//     },

//     // ✅ Sadece statü güncelle (sending → failed vs.)
//      applyMessageAck(state, action) {
//       const { conversationId, messageIds = [], actionType, by, at } = action.payload;
//       const list = state.byConversation[conversationId] || [];
//       for (const id of messageIds) {
//         const m = list.find(x => x._id === id);
//         if (!m) continue;

//         if (actionType === "delivered") {
//           m.deliveredTo = m.deliveredTo || [];
//           if (!m.deliveredTo.some(x => String(x.user) === String(by))) {
//             m.deliveredTo.push({ user: by, at: at || new Date().toISOString() });
//           }
//         } else if (actionType === "read") {
//           // read geldiğinde delivered da garanti olsun
//           m.deliveredTo = m.deliveredTo || [];
//           if (!m.deliveredTo.some(x => String(x.user) === String(by))) {
//             m.deliveredTo.push({ user: by, at: at || new Date().toISOString() });
//           }
//           m.readBy = m.readBy || [];
//           if (!m.readBy.some(x => String(x.user) === String(by))) {
//             m.readBy.push({ user: by, at: at || new Date().toISOString() });
//           }
//         }
//       }
//     },

//     // updateMessageReceipts(state, action) {
//     //   const { conversationId, messageId, messageIds, userId, status } = action.payload;
//     //   const list = state.byConversation[conversationId] || [];
//     //   const apply = (id) => {
//     //     const msg = list.find((m) => m._id === id);
//     //     if (!msg) return;
//     //     if (!msg.receipts || typeof msg.receipts !== "object") msg.receipts = {};
//     //     msg.receipts[userId] = status;
//     //   };
//     //   if (Array.isArray(messageIds)) messageIds.forEach(apply);
//     //   else if (messageId) apply(messageId);
//     // },
    

//     resetMessages(state) {
//       state.byConversation = {};
//     },
//   },
// });



// export const {
//   addOrUpdateMessages,
//   applyMessageAck,
//   addOptimisticMessage,
//   replaceTempMessage,
//   resetMessages
// } = messageSlice.actions;

// export default messageSlice.reducer;


// src/slices/messageSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // byConversation: { [conversationId]: [msg, msg, ...] }
  byConversation: {},
};

// === helper: sadece değişmişse referans oluştur ===
function shallowMergeMessage(prev, next) {
  if (!prev) return next;
  let changed = false;
  const merged = { ...prev };

  for (const [k, v] of Object.entries(next)) {
    if (prev[k] !== v) {
      merged[k] = v;
      changed = true;
    }
  }

  return changed ? merged : prev;
}

// === helper: tarih veya id bazlı sıralama ===
function sortMessages(list) {
  if (list.length <= 1) return list;
  return list.slice().sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb || (a._id > b._id ? 1 : -1);
  });
}

const messageSlice = createSlice({
  name: "messages",
  initialState,
  reducers: {
    /** ✅ Mesajları upsert et (append veya prepend) */
    addOrUpdateMessages(state, action) {
      const { conversationId, messages = [], direction = "append" } =
        action.payload || {};
      if (!conversationId) return;

      const prev = state.byConversation[conversationId] || [];
      const indexById = new Map(prev.map((m, i) => [String(m._id), i]));
      let changed = false;

      const next = [...prev];

      for (const msg of messages) {
        const id = String(msg._id);
        if (indexById.has(id)) {
          const idx = indexById.get(id);
          const merged = shallowMergeMessage(next[idx], msg);
          if (merged !== next[idx]) {
            next[idx] = merged;
            changed = true;
          }
        } else {
          if (direction === "prepend") next.unshift(msg);
          else next.push(msg);
          changed = true;
        }
      }

      if (changed) {
        // yalnızca yeni mesaj eklendiyse sort
        state.byConversation[conversationId] = sortMessages(next);
      }
    },

    /** ✅ Optimistic message (append only) */
    addOptimisticMessage(state, action) {
      const { conversationId, message } = action.payload || {};
      if (!conversationId || !message) return;

      const prev = state.byConversation[conversationId] || [];
      const exists = prev.some((m) => m._id === message._id);
      if (!exists) {
        state.byConversation[conversationId] = [...prev, message];
      }
    },

    /** ✅ Replace temp message after ACK (tempId → real msg) */
    replaceTempMessage(state, action) {
      const { conversationId, tempId, message } = action.payload || {};
      if (!conversationId || !tempId || !message) return;

      const prev = state.byConversation[conversationId] || [];
      const next = prev.map((m) =>
        String(m._id) === String(tempId) ? message : m
      );

      const exists = next.some((m) => String(m._id) === String(message._id));
      if (!exists) next.push(message);

      // sadece referans değişmişse state güncelle
      if (next !== prev) {
        state.byConversation[conversationId] = sortMessages(next);
      }
    },

    /** ✅ Delivered / Read status update (O(1) lookup) */
    applyMessageAck(state, action) {
      const { conversationId, messageIds = [], actionType, by, at } =
        action.payload || {};
      if (!conversationId || !Array.isArray(messageIds)) return;

      const list = state.byConversation[conversationId];
      if (!list?.length) return;

      const indexMap = new Map(list.map((m, i) => [String(m._id), i]));
      const timestamp = at || new Date().toISOString();

      for (const id of messageIds) {
        const idx = indexMap.get(String(id));
        if (idx === undefined) continue;
        const msg = list[idx];
        let changed = false;

        if (actionType === "delivered") {
          msg.deliveredTo = msg.deliveredTo || [];
          if (!msg.deliveredTo.some((x) => String(x.user) === String(by))) {
            msg.deliveredTo = [
              ...msg.deliveredTo,
              { user: by, at: timestamp },
            ];
            changed = true;
          }
        } else if (actionType === "read") {
          msg.deliveredTo = msg.deliveredTo || [];
          msg.readBy = msg.readBy || [];

          if (!msg.deliveredTo.some((x) => String(x.user) === String(by))) {
            msg.deliveredTo = [
              ...msg.deliveredTo,
              { user: by, at: timestamp },
            ];
            changed = true;
          }
          if (!msg.readBy.some((x) => String(x.user) === String(by))) {
            msg.readBy = [...msg.readBy, { user: by, at: timestamp }];
            changed = true;
          }
        }

        // referans değişimi minimal tutuldu (sadece gerekirse)
        if (changed) list[idx] = { ...msg };
      }
    },

    /** ✅ Reset all messages */
    resetMessages() {
      return initialState;
    },
  },
});

export const {
  addOrUpdateMessages,
  addOptimisticMessage,
  replaceTempMessage,
  applyMessageAck,
  resetMessages,
} = messageSlice.actions;

export default messageSlice.reducer;
