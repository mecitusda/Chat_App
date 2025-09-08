import localforage from "localforage";

export const fileStore = localforage.createInstance({
  name: "ChatCache",
  storeName: "files", // key -> objectURL string or base64 (small)
});

export const msgStore = localforage.createInstance({
  name: "ChatCache",
  storeName: "messages", // conversationId -> Message[]
});