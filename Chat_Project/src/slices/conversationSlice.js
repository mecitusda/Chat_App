// features/conversations/conversationsSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  list: [], // [{ _id, name, members, lastMessage, updatedAt, unreadCount, ... }]
};

// last activity'yi hesapla: lastMessage.createdAt > updatedAt ?
const getLastActivityTs = (c) => {
  const lm = c?.lastMessage?.createdAt ? new Date(c.lastMessage.createdAt).getTime() : -1;
  const up = c?.updatedAt ? new Date(c.updatedAt).getTime() : -1;
  return Math.max(lm, up);
};

function mergeConversation(prev, update) {
  // last_message deep merge
  const nextLast = {
    ...(prev.last_message || {}),
    ...(update.last_message || {}),
    message: {
      ...(prev.last_message?.message || {}),
      ...(update.last_message?.message || {}),
    },
    sender: update.last_message?.sender ?? prev.last_message?.sender,
  };

  const next = {
    ...prev,
    ...update,
    last_message: nextLast,
  };

  // unread'i asla rastgele sıfırlama!
  // - payload açıkça unread veriyorsa onu kullan
  // - vermiyorsa eski değeri koru
  if (Object.prototype.hasOwnProperty.call(update, "unread")) {
    next.unread = update.unread ?? 0;
  } else {
    next.unread = prev.unread ?? 0;
  }

  return next;
}

// list içinde upsert + sıralama (son aktiviteye göre)
function upsertConversations(oldList = [], incoming = []) {
  const arr = Array.isArray(incoming) ? incoming : [incoming];
  const byId = new Map(oldList.map(c => [c._id, c]));

  arr.forEach(nc => {
    const prev = byId.get(nc._id);
    if (!prev) {
      // yeni konuşma
      byId.set(nc._id, { unreadCount: 0, ...nc });
    } else {
      // merge: eskide olup yeni payload'da olmayan alanları koru
      // lastMessage yeniyse güncelle
      const prevTs = getLastActivityTs(prev);
      const nextTs = getLastActivityTs(nc);
      const merged = { ...prev, ...nc };
      // son aktivite geriye gitmesin (opsiyonel, sadece güvenlik)
      merged._lastActivity = Math.max(prevTs, nextTs);
      byId.set(nc._id, merged);
    }
  });

  const result = Array.from(byId.values());
  // sıralama: en yeni en üstte
  result.sort((a, b) => {
    const ta = a._lastActivity ?? getLastActivityTs(a);
    const tb = b._lastActivity ?? getLastActivityTs(b);
    return tb - ta;
  });
  // internal alanı temizle (UI'a sızmasın)
  result.forEach(c => { if ('_lastActivity' in c) delete c._lastActivity; });
  return result;
}


function convTime(c) {
  return new Date(
    c?.last_message?.createdAt ||
    c?.last_message?.message?.createdAt ||   // populate geldiyse
    c?.updated_at ||
    c?.created_at ||
    0
  ).getTime();
}

function sortConversations(list) {
  return list.slice().sort((a, b) => convTime(b) - convTime(a));
}
const conversationsSlice = createSlice({
  name: "conversations",
  initialState,
  reducers: {
    // İlk yükleme gibi tam listeyi bilerek ezmek istersen
    setConversations(state, action) {
      const arr = action.payload || [];
      state.list = upsertConversations([], arr);
    },

    // Tek tek veya dizi halinde upsert
    // addOrUpdateConversations(state, action) {
    //   const incoming = action.payload; // tek conv veya [conv]
    //   state.list = upsertConversations(state.list, incoming);
    // },
  addOrUpdateConversations(state, action) {
    const updates = Array.isArray(action.payload)
      ? action.payload
      : [action.payload];

    if (updates.length === 0) return;

    updates.forEach(update => {
      //console.log("güncelleniyor: ",update)
      const convId = update._id;
      const idx = state.list.findIndex(c => String(c._id) === String(convId));
     
    if (idx >= 0) {
      if(state.list[idx].last_message.message?.text !== update.last_message.message?.text || state.list[idx].last_message.message?.media_key !== update.last_message.message?.media_key){
      state.list[idx] = mergeConversation(state.list[idx], update);
      }
    } 
    else if(idx<0){
      // yoksa ekle
      state.list.unshift(update);
      
    }
    else{
      return
    }
    state.list = sortConversations(state.list); 
  });
},

    // Sadece belirli alanları patch'le (isim, avatar vs.)
    patchConversation(state, action) {
      const patch = action.payload; // {_id, ...fields}
      const i = state.list.findIndex(c => c._id === patch._id);
      if (i !== -1) {
        state.list[i] = { ...state.list[i], ...patch };
      }
      state.list = upsertConversations(state.list, []); // sırayı tazele
    },

    // Son mesaj geldiğinde rahatça çağır
    setLastMessage(state, action) {
      const { conversationId, lastMessage } = action.payload;
      const i = state.list.findIndex(c => c._id === conversationId);
      if (i === -1) return;
      state.list[i] = { ...state.list[i], lastMessage, updatedAt: lastMessage?.createdAt || state.list[i].updatedAt };
      state.list = upsertConversations(state.list, []); // sırayı güncelle
    },
    setUnread(state, action) {
      const { conversationId, by = 1 } = action.payload;
      const c = state.list.findIndex(x => String(x._id) === String(conversationId));
      if (c !== -1) state.list[c].unread = by
    },

    incrementUnread(state, action) {
      const { conversationId, by = 1 } = action.payload;
      const c = state.list.findIndex(x => String(x._id) === String(conversationId));
      if (c !== -1) state.list[c].unread = (state.list[c].unread ?? 0) + by
    },

    // 👇 YENİ: unread’i sıfırla
    resetUnread(state, action) {
      const conversationId = action.payload;
      const c = state.list.find(x => String(x._id) === String(conversationId));
      if (c) c.unread = 0;
    },

    // konuşma sil
    removeConversation(state, action) {
      const id = action.payload; // conversationId
      state.list = state.list.filter(c => c._id !== id);
    },

    resetConversation() {
      return initialState;
    },
  },
});

export const {
  setConversations,
  addOrUpdateConversations,
  patchConversation,
  setLastMessage,
  setUnread,
  incrementUnread,
  resetUnread,
  removeConversation,
  resetConversation,

} = conversationsSlice.actions;

export default conversationsSlice.reducer;
