// // hooks/useSocket.js
// import { useEffect, useMemo, useState } from "react";
// import { useDispatch ,useSelector  } from "react-redux";
// import { io } from "socket.io-client";
// import { setPresence, setPresenceBulk } from "../slices/presenceSlice";
// import {
// setUnread
// } from "../slices/conversationSlice";
// import { upsertProfileAvatars } from "../utils/upsertProfileAvatars";
// import {store} from "../store/index"
// import { useUser } from "../contextAPI/UserContext";
// /**
//  * status: "connecting" | "connected" | "reconnecting" | "offline"
//  * addOrUpdateConversations: slice action creator (payload: conversations array)
//  */
// export const getPeerIdsFromConversation = (c, meId) => {
//   if (!c || !Array.isArray(c.members)) return [];
//   const my = String(meId);
//   if (c.type === "private") {
//     const [a, b] = c.members.map(m => String(m?.user?._id || m?.user));
//     if (!a || !b) return [];
//     return [a === my ? b : a];
//   }
//   // group
//   return c.members
//     .map(m => String(m?.user?._id || m?.user))
//     .filter(uid => uid && uid !== my);
// };

// export function useSocket(SOCKET_URL, userId, addOrUpdateConversations,conversations,friends,dispatch,setSpinner, setProgress) {
//   console.log("değişti.");
//   //const dispatch = useDispatch();
//   const [status, setStatus] = useState("connecting");

//   const socket = useMemo(() => {
//     if (!SOCKET_URL) return null;
//     return io(SOCKET_URL, {
//       // WS’i zorlamak istersen bırak, yoksa polling fallback da kalsın:
//       transports: ["websocket"],
//       reconnection: true,
//       reconnectionAttempts: 5,     // toplam deneme sayısı
//       reconnectionDelay: 2000,     // 2 sn aralık
//       reconnectionDelayMax: 4000,  // en fazla 4 sn
//     });
//   }, [SOCKET_URL]);

//   useEffect(() => {
//     if (!socket) return;
//     setProgress(20)
//     // ---- Server events ----
//     const onChatList = (payload) => {
//       setProgress(40)
//       // payload yapın: { conversations: [...] } ise:
//       const list = Array.isArray(payload?.conversations) ? payload.conversations : payload;
//       if (Array.isArray(list) && list.length >= 0) {
//         dispatch(addOrUpdateConversations(list));
//       }
//       console.log("sockettan güncellendi.")
//       for (const conv of payload.conversations) {
//         const myUnread = conv?.members.find((m) => m.user._id === userId);
        
//           dispatch(setUnread({ conversationId: conv._id, by: myUnread.unread }));
        
//       }
//       upsertProfileAvatars(list, userId, dispatch,store.getState);
//       setProgress(60)
//       setSpinner(false)
//     };



//     const last_seen = localStorage.getItem("last_seen");
//     const onConnect = () => {
//       setStatus("connected");
//       setSpinner(true)
//       if (userId) socket.emit("join-chat", {userId,last_seen}); // server chatList’i emit edecek
//     };

//     const onDisconnect = () => setStatus("reconnecting");
//     const onConnectError = () => setStatus("reconnecting");
//     const onReconnectAttempt = () => setStatus("reconnecting");
//     const onReconnectFailed = () => setStatus("offline");

//     socket.on("presence:update", (p) =>{
//       dispatch(setPresence(p))

//     });
//     socket.on("chatList", onChatList);
//     socket.on("connect", onConnect);
//     socket.on("disconnect", onDisconnect);
//     socket.on("connect_error", onConnectError);
//     socket.io.on("reconnect_attempt", onReconnectAttempt);
//     socket.io.on("reconnect_failed", onReconnectFailed);

//     return () => {
//       socket.off("chatList", onChatList);
//       socket.off("connect", onConnect);
//       socket.off("presence:update");
//       socket.off("disconnect", onDisconnect);
//       socket.off("connect_error", onConnectError);
//       socket.io.off("reconnect_attempt", onReconnectAttempt);
//       socket.io.off("reconnect_failed", onReconnectFailed);
//       socket.close();
//     };
//   }, [socket, userId, dispatch, addOrUpdateConversations,upsertProfileAvatars]);

//   useEffect(() => {
//     if (!socket || !userId) return;

//     const convPeerIds = conversations
//     .flatMap(c => getPeerIdsFromConversation(c, userId))
//     .filter(Boolean);
//     const friendIds = (friends || []).map(f => f?._id).filter(Boolean);;

//   // Tekrarları silmek için Set kullanıyoruz
//     const ids = Array.from(new Set([...convPeerIds, ...friendIds]));
//     if (ids.length === 0) return;
//     socket.emit("presence:subscribe", { userIds: ids });
//     socket.emit("presence:who", { userIds: ids }, (map) => {
//       // map: { [userId]: {online, lastSeen} }
//       dispatch(setPresenceBulk(map));
//     });

//     // (opsiyonel) sayfadan çıkarken unsubscribe
//     return () => socket.emit("presence:unsubscribe", { userIds: ids });
//   }, [socket, userId, conversations, dispatch]);




//   return { socket, status, isConnected: status === "connected" };
// }


import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { setPresence, setPresenceBulk } from "../slices/presenceSlice";
import { setUnread } from "../slices/conversationSlice";

import { store } from "../store";

export function useSocket(SOCKET_URL, userId, addOrUpdateConversations, conversations, friends, dispatch, setSpinner, setProgress) {
  const socketRef = useRef(null);
  const [status, setStatus] = useState("connecting");

  // ✅ sadece ilk mount'ta socket kur
  if (!socketRef.current && SOCKET_URL) {
    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 4000,
    });
  }

  const socket = socketRef.current;

  useEffect(() => {
    if (!socket) return;
    setProgress(20);

    const onChatList = (payload) => {
      setProgress(40);
      const list = Array.isArray(payload?.conversations)
        ? payload.conversations
        : payload;
      if (Array.isArray(list)) {
        dispatch(addOrUpdateConversations(list));
      }
      console.log("socketten güncellendi.");

      for (const conv of payload.conversations || []) {
        const myUnread = conv?.members?.find((m) => m.user._id === userId);
        if (myUnread) {
          dispatch(setUnread({ conversationId: conv._id, by: myUnread.unread }));
        }
      }


      setProgress(60);
      setSpinner(false);
    };

    const last_seen = localStorage.getItem("last_seen");
    const onConnect = () => {
      setStatus("connected");
      setSpinner(true);
      if (userId) socket.emit("join-chat", { userId, last_seen });
    };

    const onDisconnect = () => setStatus("reconnecting");
    const onConnectError = () => setStatus("reconnecting");
    const onReconnectAttempt = () => setStatus("reconnecting");
    const onReconnectFailed = () => setStatus("offline");

    socket.on("chatList", onChatList);
    socket.on("presence:update", (p) => dispatch(setPresence(p)));
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect_failed", onReconnectFailed);

    return () => {
      socket.off("chatList", onChatList);
      socket.off("presence:update");
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect_failed", onReconnectFailed);
      // ❌ socket.close() yapma! Tek bağlantı kalmalı
    };
  }, [socket, userId, dispatch, addOrUpdateConversations]);

  useEffect(() => {
    if (!socket || !userId) return;
    const convPeerIds = conversations
      .flatMap((c) =>
        c.type === "private"
          ? c.members
              .map((m) => String(m?.user?._id || m?.user))
              .filter((id) => id && id !== String(userId))
          : c.members.map((m) => String(m?.user?._id || m?.user))
      )
      .filter(Boolean);

    const friendIds = (friends || []).map((f) => f?._id).filter(Boolean);
    const ids = Array.from(new Set([...convPeerIds, ...friendIds]));
    if (ids.length === 0) return;

    socket.emit("presence:subscribe", { userIds: ids });
    socket.emit("presence:who", { userIds: ids }, (map) => {
      dispatch(setPresenceBulk(map));
    });

    return () => socket.emit("presence:unsubscribe", { userIds: ids });
  }, [socket, userId, conversations, friends, dispatch]);

  return { socket, status, isConnected: status === "connected" };
}
