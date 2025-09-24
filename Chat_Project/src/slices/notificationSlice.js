// store/notificationSlice.js
import { createSlice, current } from "@reduxjs/toolkit";

const initialState = {
  notification: {
    message: null,
    type: "info", // "success" | "error" | "warning" | "info"
  },
};

const notificationSlice = createSlice({
  name: "notification",
  initialState,
  reducers: {
    showNotification: (state, action) => {
        console.log(action.payload)
      state.notification = {
        message: action.payload.message,
        type: action.payload.type || "info",
      };
      console.log("current: ",current(state).notification)
    },
    clearNotification: (state) => {
      state.notification = { message: null, type: "info" };
    },
  },
});

export const { showNotification, clearNotification } = notificationSlice.actions;
export default notificationSlice.reducer;
