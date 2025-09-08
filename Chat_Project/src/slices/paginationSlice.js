// slices/paginationSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  byConversation: {} // { [convId]: { hasMore: true, oldestMessageId: null } }
};

const paginationSlice = createSlice({
  name: "paginations",
  initialState,
  reducers: {
    setHasMore(state, action) {
      const { conversationId, hasMore } = action.payload;
      if (!state.byConversation[conversationId]) {
        state.byConversation[conversationId] = { hasMore: true, oldestMessageId: null };
      }
      state.byConversation[conversationId].hasMore = hasMore;
    },
    setOldestMessageId(state, action) {
      const { conversationId, messageId } = action.payload;
      if (!state.byConversation[conversationId]) {
        state.byConversation[conversationId] = { hasMore: true, oldestMessageId: null };
      }
      state.byConversation[conversationId].oldestMessageId = messageId ?? null;
    },
    resetPaginationForConversation(state, action) {
      const { conversationId } = action.payload;
      state.byConversation[conversationId] = { hasMore: true, oldestMessageId: null };
    },
    resetAllPagination() {
      return initialState;
    }
  }
});

export const {
  setHasMore,
  setOldestMessageId,
  resetPaginationForConversation,
  resetAllPagination
} = paginationSlice.actions;

export default paginationSlice.reducer;

// ---- Selectors (küçük yardımcılar)
export const selectPagination = (state, convId) =>
  state.paginations.byConversation[convId] || { hasMore: true, oldestMessageId: null };

export const selectHasMore = (state, convId) =>
  (state.paginations.byConversation[convId]?.hasMore ?? true);

export const selectOldestMessageId = (state, convId) =>
  (state.paginations.byConversation[convId]?.oldestMessageId ?? null);
