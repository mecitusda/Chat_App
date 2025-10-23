// // slices/presenceSlice.js
// import { createSelector, createSlice } from "@reduxjs/toolkit";

// const selectorCache = new Map();

// const initialState = {
//   byUser: {},
// };
// const slice = createSlice({
//   name: "presence",
//   initialState, // { [userId]: { online, lastSeen } }
//   reducers: {
//     setPresence(state, { payload }) {
//       const { userId, online, lastSeen } = payload;
//       if(!state.byUser[userId]){
//         state.byUser[userId]={}
//       }
//       state.byUser[userId] = { online, lastSeen: lastSeen ?? state.byUser[userId]?.lastSeen ?? null };
//     },
//     setPresenceBulk(state, { payload }) {
//       // payload: { [userId]: {online, lastSeen} }
       
//       for (const [uid, obj] of Object.entries(payload || {})) {
//         if(!state.byUser[uid]){
//         state.byUser[uid]={}
//         }
//         state.byUser[uid] = obj;
//       }
//     }
//   }
// });

// export const { setPresence, setPresenceBulk } = slice.actions;
// export default slice.reducer;

// export const makeSelectPresence = (userId) => {
//   if (!userId) return () => null;
//   if (selectorCache.has(userId)) return selectorCache.get(userId);

//   const selector = createSelector(
//     (state) => state.presences?.byUser?.[userId],
//     (presence) =>
//       presence
//         ? { online: presence.online, lastSeen: presence.lastSeen ?? null }
//         : null
//   );
//   selectorCache.set(userId, selector);
//   return selector;
// };


// slices/presenceSlice.js
import { createSelector, createSlice } from "@reduxjs/toolkit";

const selectorCache = new Map();

const initialState = {
  byUser: {}, // { userId: { online, lastSeen } }
};

const presenceSlice = createSlice({
  name: "presences",
  initialState,
  reducers: {
    /** ✅ Tek bir kullanıcının presence'ını güncelle (yalnızca değişmişse) */
    setPresence(state, { payload }) {
      const { userId, online, lastSeen } = payload || {};
      if (!userId) return;

      const prev = state.byUser[userId];
      if (!prev) {
        state.byUser[userId] = {
          online: !!online,
          lastSeen: lastSeen ?? null,
        };
      } else {
        const changed =
          prev.online !== !!online ||
          (lastSeen !== undefined && prev.lastSeen !== lastSeen);

        if (changed) {
          state.byUser[userId] = {
            online: !!online,
            lastSeen: lastSeen ?? prev.lastSeen ?? null,
          };
        }
      }
    },

    /** ✅ Toplu güncelleme (yalnızca değişen kullanıcılar) */
    setPresenceBulk(state, { payload }) {
      for (const [uid, obj] of Object.entries(payload || {})) {
        const prev = state.byUser[uid];
        const nextOnline = !!obj.online;
        const nextSeen = obj.lastSeen ?? prev?.lastSeen ?? null;

        if (!prev) {
          state.byUser[uid] = { online: nextOnline, lastSeen: nextSeen };
          continue;
        }

        if (prev.online !== nextOnline || prev.lastSeen !== nextSeen) {
          state.byUser[uid] = { online: nextOnline, lastSeen: nextSeen };
        }
      }
    },
  },
});

export const { setPresence, setPresenceBulk } = presenceSlice.actions;
export default presenceSlice.reducer;

/**
 * ✅ Memoized selector factory (her userId için sabit referans)
 */
export const makeSelectPresence = (userId) => {
  if (!userId) return () => null;

  // Eğer cache'de varsa doğrudan onu döndür
  if (selectorCache.has(userId)) return selectorCache.get(userId);

  // Redux createSelector memoization kullanır
  const selector = createSelector(
    [(state) => state.presences?.byUser?.[userId]],
    (presence) => {
      // referans sabitleme: aynı değer geldiyse aynı obje döndür
      if (!presence) return null;

      // küçük internal cache tutalım
      let last = selector._last;
      if (
        last &&
        last.online === presence.online &&
        last.lastSeen === presence.lastSeen
      ) {
        return last; // referans aynı kalır
      }

      const res = {
        online: presence.online,
        lastSeen: presence.lastSeen ?? null,
      };
      selector._last = res;
      return res;
    }
  );

  selectorCache.set(userId, selector);
  return selector;
};
