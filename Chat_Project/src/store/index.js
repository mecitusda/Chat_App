import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage"; // localStorage for small UI state
import filesReducer from "../slices/fileSlice";
import messagesReducer from "../slices/messageSlice";
import conversationsReducer from "../slices/conversationSlice";
import paginationReducer from "../slices/paginationSlice"
import presenceSliceReducer from "../slices/presenceSlice"
import uiSliceReducer from "../slices/uiSlice"
import friendSliceReducer from "../slices/friendSlice"
import notificationReducer from "../slices/notificationSlice"
import callReducer from "../slices/callSlice"
const rootPersistConfig = {
  key: "root",
  storage,
  whitelist: ["files", "messages", "conversations","paginations","presences","uiSlices","notifications","friends","calls"], // keep small indexes/metadata in LS
};

const rootReducer = combineReducers({
  files: filesReducer,
  messages: messagesReducer,
  conversations: conversationsReducer,
  paginations: paginationReducer,
  presences:presenceSliceReducer,
  ui:uiSliceReducer,
  friends:friendSliceReducer,
  notifications:notificationReducer,
  calls:callReducer
});

const persistedReducer = persistReducer(rootPersistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export const persistor = persistStore(store);