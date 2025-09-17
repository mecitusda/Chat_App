// hooks/useSocket.js
import { useEffect, useMemo, useState } from "react";
import { useDispatch ,useSelector  } from "react-redux";
import { io } from "socket.io-client";
import { setPresence, setPresenceBulk } from "../slices/presenceSlice";
import {
resetUnread,
setUnread
} from "../slices/conversationSlice";
import { upsertProfileAvatars } from "../utils/upsertProfileAvatars";
import {store} from "../store/index"
/**
 * status: "connecting" | "connected" | "reconnecting" | "offline"
 * addOrUpdateConversations: slice action creator (payload: conversations array)
 */
export const getPeerIdsFromConversation = (c, meId) => {
  if (!c || !Array.isArray(c.members)) return [];
  const my = String(meId);
  if (c.type === "private") {
    const [a, b] = c.members.map(m => String(m?.user?._id || m?.user));
    if (!a || !b) return [];
    return [a === my ? b : a];
  }
  // group
  return c.members
    .map(m => String(m?.user?._id || m?.user))
    .filter(uid => uid && uid !== my);
};

export function useSocket(SOCKET_URL, userId, addOrUpdateConversations,conversations,dispatch) {
  //const dispatch = useDispatch();
  const [status, setStatus] = useState("connecting");

  const socket = useMemo(() => {
    if (!SOCKET_URL) return null;
    return io(SOCKET_URL, {
      // WS’i zorlamak istersen bırak, yoksa polling fallback da kalsın:
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,     // toplam deneme sayısı
      reconnectionDelay: 2000,     // 2 sn aralık
      reconnectionDelayMax: 4000,  // en fazla 4 sn
    });
  }, [SOCKET_URL]);

  useEffect(() => {
    if (!socket) return;
    // ---- Server events ----
    const onChatList = (payload) => {
      // payload yapın: { conversations: [...] } ise:
      const list = Array.isArray(payload?.conversations) ? payload.conversations : payload;
      if (Array.isArray(list) && list.length >= 0) {
        dispatch(addOrUpdateConversations(list));
      }
      console.log("sockettan güncellendi.")
      const allPeers = new Set();
  for (const conv of payload.conversations) {
    if(conv.unread > 0){
      dispatch(setUnread({ conversationId: conv._id, by: conv.unread }));
    }
    for (const uid of getPeerIdsFromConversation(conv, userId)) {
      allPeers.add(uid);
    }
  }
  const ids = Array.from(allPeers);
  if (ids.length) {
    socket.emit("presence:subscribe", { userIds: ids });
    socket.emit("presence:who", { userIds: ids }, (map) => {
      // map: { [userId]: { online, lastSeen } }
      dispatch(setPresenceBulk(map));
    });
  }
    upsertProfileAvatars(list, userId, dispatch,store.getState);

 
    };
    const last_seen = localStorage.getItem("last_seen");
    const onConnect = () => {
      setStatus("connected");
      if (userId) socket.emit("join", {userId,last_seen}); // server chatList’i emit edecek
    };

    const onDisconnect = () => setStatus("reconnecting");
    const onConnectError = () => setStatus("reconnecting");
    const onReconnectAttempt = () => setStatus("reconnecting");
    const onReconnectFailed = () => setStatus("offline");

    socket.on("presence:update", (p) => dispatch(setPresence(p)));
    socket.on("chatList", onChatList);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect_failed", onReconnectFailed);

    return () => {
      socket.off("chatList", onChatList);
      socket.off("connect", onConnect);
      socket.off("presence:update");
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect_failed", onReconnectFailed);
      socket.close();
    };
  }, [socket, userId, dispatch, addOrUpdateConversations,upsertProfileAvatars]);

  useEffect(() => {
    if (!socket || !userId) return;

    const peerIds = conversations
      .map(c => getPeerIdsFromConversation(c, userId))
      .filter(Boolean);

    if (peerIds.length === 0) return;
    socket.emit("presence:subscribe", { userIds: peerIds });
    socket.emit("presence:who", { userIds: peerIds }, (map) => {
      // map: { [userId]: {online, lastSeen} }
      dispatch(setPresenceBulk(map));
    });

    // (opsiyonel) sayfadan çıkarken unsubscribe
    return () => socket.emit("presence:unsubscribe", { userIds: peerIds });
  }, [socket, userId, conversations, dispatch]);




  return { socket, status, isConnected: status === "connected" };
}
