// slices/presenceSlice.js
import { createSlice } from "@reduxjs/toolkit";
const initialState = {
  byUser: {},
};
const slice = createSlice({
  name: "presence",
  initialState, // { [userId]: { online, lastSeen } }
  reducers: {
    setPresence(state, { payload }) {
      const { userId, online, lastSeen } = payload;
      if(!state.byUser[userId]){
        state.byUser[userId]={}
      }
      state.byUser[userId] = { online, lastSeen: lastSeen ?? state.byUser[userId]?.lastSeen ?? null };
    },
    setPresenceBulk(state, { payload }) {
      // payload: { [userId]: {online, lastSeen} }
       
      for (const [uid, obj] of Object.entries(payload || {})) {
        if(!state.byUser[uid]){
        state.byUser[uid]={}
        }
        state.byUser[uid] = obj;
      }
    }
  }
});

export const { setPresence, setPresenceBulk } = slice.actions;
export default slice.reducer;

export const selectPresence = (s, userId) => s.presences.byUser[userId] || { online: false, lastSeen: null };
