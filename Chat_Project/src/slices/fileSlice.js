// slices/filesSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // byKey[conversationId] = Array<{ media_key, media_url?, expiresAt?, type?, ... }>
  byKey: {},
};

// Helper: merge-by media_key (eski alanları korur, gelenleri günceller)
function mergeFilesByKey(oldArr = [], incomingArr = []) {
  const byKey = new Map(oldArr.map(f => [f.media_key, f]));
  incomingArr.forEach(it => {
    const prev = byKey.get(it.media_key) || { media_key: it.media_key };
    byKey.set(it.media_key, { ...prev, ...it });
  });
  return Array.from(byKey.values());
}

const filesSlice = createSlice({
  name: "files",
  initialState,
  reducers: {
    // Bir konuşmadaki dosya listesini "bilerek" komple set etmek istersen (örn. ilk yükleme)
    setFiles(state, action) {
      const { conversationId, files } = action.payload;
      // Not: Burada da merge tercih edebilirsin. İlk yükleme ise direkt atamak OK.
      state.byKey[conversationId] = Array.isArray(files) ? files : [];
      // console.log("slice değişti: ", state.byKey[conversationId]);
    },

    // 👇 En güvenlisi: sadece gelenleri upsert et (override ETME)
    upsertFiles(state, action) {
      const { conversationId, files } = action.payload;
      const prev = state.byKey[conversationId] || [];
      state.byKey[conversationId] = mergeFilesByKey(prev, files || []);
    },

    // Tek dosya upsert
    upsertFile(state, action) {
      const { conversationId, file } = action.payload; // { media_key, ... }
      const prev = state.byKey[conversationId] || [];
      state.byKey[conversationId] = mergeFilesByKey(prev, [file]);
    },

    // Belirli media_key'leri sil
    removeFiles(state, action) {
      const { conversationId, mediaKeys } = action.payload; // string[]
      const prev = state.byKey[conversationId] || [];
      state.byKey[conversationId] = prev.filter(f => !mediaKeys.includes(f.media_key));
    },

    // Konuşmanın tüm dosyalarını sil
    clearConversationFiles(state, action) {
      const { conversationId } = action.payload;
      delete state.byKey[conversationId];
    },

    // TTL temizliği (expire olmuşları at)
    purgeExpired(state, action) {
      const { conversationId, now = Date.now() } = action.payload;
      const prev = state.byKey[conversationId] || [];
      state.byKey[conversationId] =
        prev.filter(f => !f.expiresAt || f.expiresAt > now);
    },

    resetFile() {
      return initialState;
    },
  },
});

export const {
  setFiles,
  upsertFiles,
  upsertFile,
  removeFiles,
  clearConversationFiles,
  purgeExpired,
  resetFile,
} = filesSlice.actions;

export default filesSlice.reducer;
