// // slices/uiSlice.js
// import { createSlice } from "@reduxjs/toolkit";

// const uiSlice = createSlice({
//   name: "ui",
//   initialState: {
//     atBottomByConv: {} // { [convId]: boolean }
//   },
//   reducers: {
//     setAtBottom(state, action) {
//       const { conversationId, atBottom } = action.payload;
//       state.atBottomByConv[conversationId] = !!atBottom;
//     },
//     resetAtBottom(state, action) {
//       const { conversationId } = action.payload;
//       delete state.atBottomByConv[conversationId];
//     }
//   }
// });

// export const { setAtBottom, resetAtBottom } = uiSlice.actions;
// export const selectAtBottom = (s, convId) =>
//   !!s.ui.atBottomByConv[convId];

// export default uiSlice.reducer;

// slices/uiSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  atBottomByConv: {}, // { [convId]: boolean }
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {

    setAtBottom(state, action) {
      const { conversationId, atBottom } = action.payload || {};
      if (!conversationId) return;

      const prev = state.atBottomByConv[conversationId];
      const next = !!atBottom;
      if (prev !== next) {
        state.atBottomByConv[conversationId] = next;
      }
    },

    resetAtBottom(state, action) {
      const { conversationId } = action.payload || {};
      if (!conversationId) return;
      if (conversationId in state.atBottomByConv) {
        delete state.atBottomByConv[conversationId];
      }
    },


    resetAllAtBottom() {
      return initialState;
    },
  },
});

export const { setAtBottom, resetAtBottom, resetAllAtBottom } =
  uiSlice.actions;


export const selectAtBottom = (state, convId) =>
  !!state.ui.atBottomByConv[convId];

export default uiSlice.reducer;
