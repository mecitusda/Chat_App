import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  friends: [],   // arkadaş listesi
  requests: [],  // gelen arkadaşlık istekleri
};

const friendsSlice = createSlice({
  name: "friends",
  initialState,
  reducers: {
    setFriends(state, action) {
      state.friends = action.payload || [];
    },
    setRequests(state, action) {
      state.requests = action.payload || [];
    },
    addFriend(state, action) {
      const exists = state.friends.find((f) => f._id === action.payload._id);
      if (!exists) {
        state.friends.push(action.payload);
      }
    },
    removeFriend(state, action) {
      state.friends = state.friends.filter((f) => f._id !== action.payload);
    },
    addRequest(state, action) {
      const exists = state.requests.find((r) => r._id === action.payload._id);
      if (!exists) {
        state.requests.push(action.payload);
      }
    },
    removeRequest(state, action) {
      state.requests = state.requests.filter((r) => r._id !== action.payload);
    },
    // 🔥 karşılıklı istek → otomatik arkadaş ekleme
    autoAccept(state, action) {
      const user = action.payload.user;
      if (!user) return;

      // Eğer zaten arkadaş değilse → ekle
      const alreadyFriend = state.friends.find((f) => f._id === user._id);
      if (!alreadyFriend) {
        state.friends.push(user);
      }

      // Gelen istekler listesinden temizle
      state.requests = state.requests.filter((r) => r._id !== user._id);
    },
    resetFriends(state) {
      state.friends = [];
      state.requests = [];
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
} = friendsSlice.actions;

export default friendsSlice.reducer;
