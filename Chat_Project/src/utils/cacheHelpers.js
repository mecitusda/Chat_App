import { fileStore, msgStore } from "./db";
import { setFileCache } from "../slices/filesSlice";
import { setConversationMessages } from "../slices/messagesSlice";

// Files (any type):
export async function getFileObjectURL({ key, fetchBlob, dispatch, reduxMap }) {
  // 1) RAM (Redux)
  if (reduxMap[key]) return reduxMap[key];

  // 2) IndexedDB
  const cachedUrl = await fileStore.getItem(key);
  if (cachedUrl) {
    dispatch(setFileCache({ key, url: cachedUrl }));
    return cachedUrl;
  }

  // 3) Network
  const blob = await fetchBlob(); // caller fetches with presigned URL
  const objectUrl = URL.createObjectURL(blob);
  dispatch(setFileCache({ key, url: objectUrl }));
  await fileStore.setItem(key, objectUrl);
  return objectUrl;
}

// Messages:
export async function getConversationMessages({ conversationId, fetchFromApi, dispatch, reduxByConv }) {
  // 1) RAM
  if (reduxByConv[conversationId]?.length) return reduxByConv[conversationId];

  // 2) IndexedDB
  const cached = await msgStore.getItem(conversationId);
  if (cached?.length) {
    dispatch(setConversationMessages({ conversationId, messages: cached }));
    return cached;
  }

  // 3) Network (your API)
  const { success, messages } = await fetchFromApi(conversationId);
  const list = success ? messages : [];
  dispatch(setConversationMessages({ conversationId, messages: list }));
  await msgStore.setItem(conversationId, list);
  return list;
}

export async function upsertMessage({ conversationId, message, dispatch }) {
  // update Redux
  dispatch({ type: "messages/appendConversationMessage", payload: { conversationId, message } });
  // update IndexedDB
  const existing = (await msgStore.getItem(conversationId)) || [];
  existing.push(message);
  await msgStore.setItem(conversationId, existing);
}

// Optional helpers
export async function clearConversationCache(conversationId) {
  await msgStore.removeItem(conversationId);
}

export async function clearAllCaches() {
  await Promise.all([fileStore.clear(), msgStore.clear()]);
}