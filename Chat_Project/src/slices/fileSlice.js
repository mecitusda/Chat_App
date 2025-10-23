// // slices/filesSlice.js
// import { createSlice, current} from "@reduxjs/toolkit";

// const initialState = {
//   // byKey[conversationId] = Array<{ media_key, media_url?, expiresAt?, type?, ... }>
//   byKey: {},
// };

// // Helper: merge-by media_key (eski alanları korur, gelenleri günceller)
// function mergeFilesByKey(oldArr = [], incomingArr = []) {
//   const byKey = new Map(oldArr.map(f => [f.media_key, f]));
//   incomingArr.forEach(it => {
//     const prev = byKey.get(it.media_key) || { media_key: it.media_key };
//     byKey.set(it.media_key, { ...prev, ...it });
//   });
//   return Array.from(byKey.values());
// }

// const filesSlice = createSlice({
//   name: "files",
//   initialState,
//   reducers: {
//     // Bir konuşmadaki dosya listesini "bilerek" komple set etmek istersen (örn. ilk yükleme)
//     setFiles(state, action) {
//       const { conversationId, files } = action.payload;
//       // Not: Burada da merge tercih edebilirsin. İlk yükleme ise direkt atamak OK.
//       state.byKey[conversationId] = Array.isArray(files) ? files : [];
//       // console.log("slice değişti: ", state.byKey[conversationId]);
//     },

//     // 👇 En güvenlisi: sadece gelenleri upsert et (override ETME)
//     upsertFiles(state, action) {
//   const { conversationId, files } = action.payload;
//   if (!current(state).byKey[conversationId]) {
//     state.byKey[conversationId] = {};
//   }


//   // Her bir messageId için merge et
//   Object.entries(files).forEach(([msgId, file]) => {
//     state.byKey[conversationId][msgId] = {
//       ...state.byKey[conversationId][msgId], // önceki varsa koru
//       ...file, // yenisiyle güncelle
//     };
//   });
// },


//     // Belirli media_key'leri sil
//     removeFiles(state, action) {
//       const { conversationId, mediaKeys } = action.payload; // string[]
//       const prev = state.byKey[conversationId] || [];
//       state.byKey[conversationId] = prev.filter(f => !mediaKeys.includes(f.media_url));
//     },

//     // Konuşmanın tüm dosyalarını sil
//     clearConversationFiles(state, action) {
//       const { conversationId } = action.payload;
//       delete state.byKey[conversationId];
//     },

//     // TTL temizliği (expire olmuşları at)
//     purgeExpired(state, action) {
//       const { conversationId, now = Date.now() } = action.payload;
//       const prev = state.byKey[conversationId] || [];
//       state.byKey[conversationId] =
//         prev.filter(f => !f.expiresAt || f.expiresAt > now);
//     },

//     resetFile() {
//       return initialState;
//     },
//   },
// });

// export const {
//   setFiles,
//   upsertFiles,
//   removeFiles,
//   clearConversationFiles,
//   purgeExpired,
//   resetFile,
// } = filesSlice.actions;

// export default filesSlice.reducer;

// slices/fileSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // byKey[conversationId][messageId] = { media_url, expiresAt, ... }
  byKey: {},
};

/**
 * Safe shallow merge:
 * aynı key varsa sadece değer değiştiğinde günceller.
 */
function mergeFiles(prev = {}, incoming = {}) {
  let changed = false;
  const next = { ...prev };

  for (const [msgId, file] of Object.entries(incoming)) {
    const oldFile = prev[msgId];
    // shallow equality check
    const same =
      oldFile &&
      oldFile.media_url === file.media_url &&
      oldFile.expiresAt === file.expiresAt;

    if (!same) {
      next[msgId] = { ...oldFile, ...file };
      changed = true;
    }
  }

  // hiçbir şey değişmediyse aynı referansı döndür
  return changed ? next : prev;
}

const fileSlice = createSlice({
  name: "files",
  initialState,
  reducers: {
    /** ✅ İlk yükleme için doğrudan set (örnek: mesaj geçmişi çekildiğinde) */
    setFiles(state, action) {
      const { conversationId, files } = action.payload || {};
      if (!conversationId) return;

      const arr = Array.isArray(files) ? files : [];
      const sameRef = state.byKey[conversationId] === arr;
      if (!sameRef) {
        state.byKey[conversationId] = arr;
      }
    },

    /**
     * ✅ Upsert – sadece değişen dosyaları merge et.
     * files param: { [messageId]: { media_url, expiresAt, ... } }
     */
    upsertFiles(state, action) {
      const { conversationId, files } = action.payload || {};
      if (!conversationId || !files) return;

      const prevFiles = state.byKey[conversationId] || {};
      const merged = mergeFiles(prevFiles, files);

      if (merged !== prevFiles) {
        state.byKey[conversationId] = merged;
      }
    },

    /** ✅ Belirli media_key'leri sil */
    removeFiles(state, action) {
      const { conversationId, mediaKeys = [] } = action.payload || {};
      if (!conversationId || !Array.isArray(mediaKeys)) return;

      const prev = state.byKey[conversationId];
      if (!prev) return;

      const next = Object.fromEntries(
        Object.entries(prev).filter(
          ([msgId, file]) => !mediaKeys.includes(file.media_key)
        )
      );

      if (Object.keys(next).length !== Object.keys(prev).length) {
        state.byKey[conversationId] = next;
      }
    },

    /** ✅ Bir konuşmanın tüm dosyalarını temizle */
    clearConversationFiles(state, action) {
      const { conversationId } = action.payload || {};
      if (!conversationId) return;
      if (state.byKey[conversationId]) {
        delete state.byKey[conversationId];
      }
    },

    /** ✅ Expire olmuşları at */
    purgeExpired(state, action) {
      const { conversationId, now = Date.now() } = action.payload || {};
      if (!conversationId) return;

      const prev = state.byKey[conversationId];
      if (!prev) return;

      const next = Object.fromEntries(
        Object.entries(prev).filter(
          ([, file]) => !file.expiresAt || file.expiresAt > now
        )
      );

      if (Object.keys(next).length !== Object.keys(prev).length) {
        state.byKey[conversationId] = next;
      }
    },

    resetFile() {
      return initialState;
    },
  },
});

export const {
  setFiles,
  upsertFiles,
  removeFiles,
  clearConversationFiles,
  purgeExpired,
  resetFile,
} = fileSlice.actions;

export default fileSlice.reducer;
