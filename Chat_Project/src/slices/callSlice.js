import { createSlice } from "@reduxjs/toolkit";

    // callSlice.js
const initialState = {
  byCallId: {} // { callId: [userIds] }
};

const callSlice = createSlice({
  name: "calls",
  initialState,
  reducers: {
    setParticipants(state, action) {
  const { callId, participants } = action.payload;
  const list = Array.isArray(participants)
    ? participants
    : new Array(participants || 0).fill(null);

  state.byCallId[callId] = {
    participants: list,
    participantsCount: list.length,
    lastUpdate: Date.now(),
  };
},
    userJoined(state, action) {
      const { callId, userId } = action.payload;
      if (!state.byCallId[callId]) state.byCallId[callId] = [];
      if (!state.byCallId[callId].includes(userId)) {
        state.byCallId[callId].push(userId);
      }
    },
    userLeft(state, action) {
      const { callId, userId } = action.payload;
      if (state.byCallId[callId]) {
        state.byCallId[callId] = state.byCallId[callId].filter(id => id !== userId);
      }
    }
  }
});

export const { setParticipants, userJoined, userLeft } = callSlice.actions;
export default callSlice.reducer;
