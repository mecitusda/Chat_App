// import { createSlice } from "@reduxjs/toolkit";
// const playNotificationSound = () => {
//   const audio = new Audio("/sounds/new-invitation.mp3");
//   audio.play().catch((error) => {
//     console.warn("🔇 Ses çalınamadı:", error);
//   });
// };
// const initialState = {
//   friends: [],   // arkadaş listesi
//   requests: [],  // gelen arkadaşlık istekleri
// };

// const friendsSlice = createSlice({
//   name: "friends",
//   initialState,
//   reducers: {
//     setFriends(state, action) {
//       state.friends = action.payload || [];
//     },
//     setRequests(state, action) {
//       state.requests = action.payload || [];
//     },
//     addFriend(state, action) {
//       const exists = state.friends.find((f) => f._id === action.payload._id);
//       if (!exists) {
//         state.friends.push(action.payload);
//       }
//     },
//     removeFriend(state, action) {
//       state.friends = state.friends.filter((f) => f._id !== action.payload);
//     },
//     addRequest(state, action) {
//       const exists = state.requests.find((r) => r._id === action.payload._id);
//       if (!exists) {
//         state.requests.push(action.payload);
//         playNotificationSound()
//       }
//     },
//     removeRequest(state, action) {
//       state.requests = state.requests.filter((r) => r._id !== action.payload);
//     },
//     // 🔥 karşılıklı istek → otomatik arkadaş ekleme
//     autoAccept(state, action) {
//       const user = action.payload.user;
//       if (!user) return;

//       // Eğer zaten arkadaş değilse → ekle
//       const alreadyFriend = state.friends.find((f) => f._id === user._id);
//       if (!alreadyFriend) {
//         state.friends.push(user);
//       }

//       // Gelen istekler listesinden temizle
//       state.requests = state.requests.filter((r) => r._id !== user._id);
//     },
//     resetFriends(state) {
//       state.friends = [];
//       state.requests = [];
//     },
//   },
// });

// export const {
//   setFriends,
//   setRequests,
//   addFriend,
//   removeFriend,
//   addRequest,
//   removeRequest,
//   autoAccept,
//   resetFriends,
// } = friendsSlice.actions;

// export default friendsSlice.reducer;


// slices/friendSlice.js
import { createSlice } from "@reduxjs/toolkit";

const playNotificationSound = () => {
  try {
    const audio = new Audio("/sounds/new-invitation.mp3");
    audio.play().catch((err) => {
      console.warn("🔇 Ses çalınamadı:", err);
    });
  } catch (err) {
    console.warn("🔇 Ses oluşturulamadı:", err);
  }
};

const initialState = {
  friends: [],
  requests: [],
};

function sameArray(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every((x, i) => x?._id === b[i]?._id);
}

const friendSlice = createSlice({
  name: "friends",
  initialState,
  reducers: {
    /** ✅ Arkadaş listesini değiştiyse güncelle */
    setFriends(state, action) {
      const next = action.payload || [];
      if (!sameArray(state.friends, next)) {
        state.friends = next;
      }
    },

    /** ✅ Gelen istek listesini değiştiyse güncelle */
    setRequests(state, action) {
      const next = action.payload || [];
      if (!sameArray(state.requests, next)) {
        state.requests = next;
      }
    },

    /** ✅ Aynı id yoksa ekle */
    addFriend(state, action) {
      const user = action.payload;
      if (!user?._id) return;
      const exists = state.friends.some((f) => f._id === user._id);
      if (!exists) {
        state.friends = [...state.friends, user];
      }
    },

    /** ✅ Arkadaşı sil (gereksiz referans değişimi yoksa dokunma) */
    removeFriend(state, action) {
      const id = action.payload;
      const filtered = state.friends.filter((f) => f._id !== id);
      if (filtered.length !== state.friends.length) {
        state.friends = filtered;
      }
    },

    /** ✅ Aynı id yoksa ekle + sadece yeniyse ses çal */
    addRequest(state, action) {
      const user = action.payload;
      if (!user?._id) return;
      const exists = state.requests.some((r) => r._id === user._id);
      if (!exists) {
        state.requests = [...state.requests, user];
        playNotificationSound();
      }
    },

    /** ✅ İsteği sil */
    removeRequest(state, action) {
      const id = action.payload;
      const filtered = state.requests.filter((r) => r._id !== id);
      if (filtered.length !== state.requests.length) {
        state.requests = filtered;
      }
    },

    /** ✅ Karşılıklı istek otomatik arkadaşlık */
    autoAccept(state, action) {
      const user = action.payload?.user;
      if (!user?._id) return;

      const alreadyFriend = state.friends.some((f) => f._id === user._id);
      if (!alreadyFriend) {
        state.friends = [...state.friends, user];
      }

      const filtered = state.requests.filter((r) => r._id !== user._id);
      if (filtered.length !== state.requests.length) {
        state.requests = filtered;
      }
    },

    /** ✅ Tüm listeyi temizle */
    resetFriends() {
      return initialState;
    },
  },
});

export const {
  setFriends,
  setRequests,
  addFriend,
  removeFriend,
  addRequest,
  removeRequest,
  autoAccept,
  resetFriends,
} = friendSlice.actions;

export default friendSlice.reducer;

