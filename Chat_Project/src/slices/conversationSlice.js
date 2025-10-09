  // features/conversations/conversationsSlice.js
  import { createSlice,current } from "@reduxjs/toolkit";

  const initialState = {
    list: [], // [{ _id, name, members, lastMessage, updatedAt, unreadCount, ... }]
  };

  // last activity'yi hesapla: lastMessage.createdAt > updatedAt ?
  const getLastActivityTs = (c) => {
    const lm = c?.lastMessage?.createdAt ? new Date(c.lastMessage.createdAt).getTime() : -1;
    const up = c?.updatedAt ? new Date(c.updatedAt).getTime() : -1;
    return Math.max(lm, up);
  };

  function idOfMember(m) {
    // m.user bir object ise _id'yi, string ise kendisini kullan
    return String(typeof m.user === "object" ? (m.user?._id || m.user?.id) : m.user);
  };

  function mergeMembers(prevMembers = [], updateMembers) {
    if (!Array.isArray(updateMembers)) return prevMembers; // update.members yoksa dokunma

    // prev'i map'e koy
    const map = new Map(prevMembers.map(m => [idOfMember(m), m]));
    //console.log("prev: ",map ,"updated: ",updateMembers)
    // her update üyesini birleştir
    for (const um of updateMembers) {
      const id = idOfMember(um);
      const pm = map.get(id);

      if (pm) {
        const merged = {
          ...pm,
          ...um,
          user: { ...(pm.user || {}), ...(um.user || {}) },
        };
        //console.log("merged: ",merged)

        // lastReadAt -> daha yeni olanı koru
        if (pm.lastReadAt || um.lastReadAt) {
          const pa = pm.lastReadAt ? new Date(pm.lastReadAt).getTime() : 0;
          const ua = um.lastReadAt ? new Date(um.lastReadAt).getTime() : 0;
          merged.lastReadAt = ua > pa ? um.lastReadAt : pm.lastReadAt;
        }

        // lastReadMessageId -> sadece update açıkça verdiyse değiştir
         if (Object.prototype.hasOwnProperty.call(um, "lastReadMessageId")) {
          //console.log("um : ",um)
          //console.log("pm: ", pm.lastReadAt)
        const pa = pm.lastReadAt ? new Date(pm.lastReadAt).getTime() : 0;
        const ua = um.lastReadAt ? new Date(um.lastReadAt).getTime() : 0;
        //console.log(pa,ua)
        if (ua >= pa) {
          //console.log("güncellendi: ",um.lastReadMessageId,"update: ",pm.lastReadMessageId)
          merged.lastReadMessageId = um.lastReadMessageId;
        }
      }
        //console.log("last merge: ",merged)
        map.set(id, merged);
      } else {
        // yeni üye
        map.set(id, um);
      }
    }

    // sıra: önce eski sıra (güncellenmiş halleri), sonra yeni eklenenler
    const prevIds = prevMembers.map(idOfMember);
    const result = prevIds.map(id => map.get(id));
    for (const [id, m] of map.entries()) {
      if (!prevIds.includes(id)) result.push(m);
    }
    //console.log("sonuç: ",result)
    return result;
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

    // members merge (yalnızca update.members varsa dokun)
    const nextMembers = Object.prototype.hasOwnProperty.call(update, "members")
      ? mergeMembers(prev.members, update.members)
      : prev.members;
      //console.log("güncel",prev.members[0].lastReadMessageId,update.members[0].lastReadMessageId)
    //console.log("nextmember: ",nextMembers)
    const next = {
      ...prev,
      ...update,
      last_message: nextLast,
      members: nextMembers,
    };

    // unread'i asla rastgele sıfırlama
    if (Object.prototype.hasOwnProperty.call(update, "unread")) {
      next.unread = update.unread ?? 0;
    } else {
      next.unread = prev.unread ?? 0;
    }

    return next;
  };
  
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
  };


  function convTime(c) {
    return new Date(
      c?.last_message?.createdAt ||
      c?.last_message?.message?.createdAt ||   // populate geldiyse
      c?.updated_at ||
      c?.created_at ||
      0
    ).getTime();
  };

  function sortConversations(list) {
    return list.slice().sort((a, b) => convTime(b) - convTime(a));
  };

  const conversationsSlice = createSlice({
    name: "conversations",
    initialState,
    reducers: {
      setConversations(state, action) {
        const arr = action.payload || [];
        state.list = upsertConversations([], arr);
      },
      updateConversationAvatars(state, action) {
      const updates = action.payload;
      console.log(updates)
      updates.forEach((u) => {
    const avatarObj = u.avatar;
    const avatar = avatarObj
      ? { url: avatarObj.url, url_expiresAt: avatarObj.url_expiresAt }
      : null;

    if (u.type === "conversation") {
      const conv = state.list.find((c) => String(c._id) === String(u.conversationId));
      if (conv && avatar) conv.avatar = avatar;
    }

    if (u.type === "user") {
      console.log("user: ",u)
      const conv = state.list.find((c) => String(c._id) === String(u.conversationId));
      if (conv) {
        const member = conv.members.find((m) => String(m.user._id) === String(u.userId));
        if (member && avatar) member.user.avatar = avatar;
      }
    }
  });
      },
      addOrUpdateConversations(state, action) {    
      const updates = Array.isArray(action.payload)
        ? action.payload
        : [action.payload];
      if (updates.length === 0) return;
        updates.forEach(update => {    
        const convId = update._id;
        const idx = state.list.findIndex(c => String(c._id) === String(convId));
      if (idx >= 0 && current(state).list[idx] !== update) {
        console.log(update)
        if(!update.unread){
        update.unread = current(state).list[idx].unread ?? 0;
        }
        state.list[idx] = update
      } 
      else if(idx<0){
        state.list.unshift(update);
      }
      else{
        return
      }
      state.list = sortConversations(state.list); 
      });
      
      },
      updateConversationCall(state, action) {
        const { conversationId, callId, participants } = action.payload;
        const conv = state.list.find((c) => c._id === conversationId);
        console.log("güncellenen participants",participants)
        if (conv) {
          conv.active_call = {_id: callId,participants:participants};
        }
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
        const c = current(state).list.findIndex(x => String(x._id) === String(conversationId));
        if (c !== -1) state.list[c].unread = by
      },
      updatedLastReadId(state, action){
        const {conversationId, lastReadMessageId, meId} = action.payload;
        const c = current(state).list.findIndex(x => String(x._id) === String(conversationId));
        const cm = current(state).list[c].members.findIndex(m => {
        const uid = typeof m.user === "object" ? (m.user?._id || m.user?.id) : m.user;
          return String(uid) === String(meId);
        });
        //console.log("önceki son mesaj",current(state).list[c].members[cm])
        if(c !== -1) {
          
          state.list[c].members[cm].lastReadMessageId = lastReadMessageId;
          state.list[c].members[cm].lastReadAt =  new Date().toISOString();
         
        }
      },

      incrementUnread(state, action) {
        const { conversationId, by = 1 } = action.payload;
        const c = state.list.findIndex(x => String(x._id) === String(conversationId));
        if (c !== -1) state.list[c].unread = (current(state).list[c].unread ?? 0) + by
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

  export const selectMyLastReadId = (state, conversationId, myUserId) => {
    if (!conversationId || !myUserId) return null;

    // list array ise: find
    const conv =
      Array.isArray(state.conversations?.list)
        ? state.conversations.list.find(c => String(c?._id) === String(conversationId))
        : // list objeyse: byId tarzı saklanmış olabilir
          state.conversations?.list?.[conversationId];

    if (!conv || !Array.isArray(conv.members)) return null;

    // member.user hem ObjectId string hem obje olabilir; ikisini de destekleyelim
    const me = conv.members.find(m => {
      const uid = typeof m.user === 'object' ? m.user?._id : m.user;
      return String(uid) === String(myUserId);
    });
    return me?.lastReadMessageId || null;
  };

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
    updatedLastReadId,
    updateConversationAvatars,
    updateConversationCall
    
  } = conversationsSlice.actions;

  export default conversationsSlice.reducer;
