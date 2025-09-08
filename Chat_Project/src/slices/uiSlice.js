// slices/uiSlice.js
import { createSlice } from "@reduxjs/toolkit";

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    atBottomByConv: {} // { [convId]: boolean }
  },
  reducers: {
    setAtBottom(state, action) {
      const { conversationId, atBottom } = action.payload;
      state.atBottomByConv[conversationId] = !!atBottom;
    },
    resetAtBottom(state, action) {
      const { conversationId } = action.payload;
      delete state.atBottomByConv[conversationId];
    }
  }
});

export const { setAtBottom, resetAtBottom } = uiSlice.actions;
export const selectAtBottom = (s, convId) =>
  !!s.ui.atBottomByConv[convId];

export default uiSlice.reducer;
