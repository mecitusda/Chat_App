// pages/Chat.jsx
import React, { useEffect, useRef, useState } from "react";
import ChatList from "../components/Chat_List";
import Option3 from "../components/Option3";
import Option4 from "../components/Option4";
import ProfileSettings from "../components/ProfileSettings";
import ChatPanel from "../components/ChatPanel";
import { useSocket } from "../hooks/useSocket";
import { useDispatch, useSelector } from "react-redux";
import { selectAtBottom } from "../slices/uiSlice";
import {
  updateConversationAvatars,
  updateConversationCall,
} from "../slices/conversationSlice";
// Conversations
import {
  addOrUpdateConversations,
  setUnread,
} from "../slices/conversationSlice";
import { MdGroup, MdPerson } from "react-icons/md";
// Messages
import { addOrUpdateMessages, applyMessageAck } from "../slices/messageSlice";

// Files (presigned URL yönetimi için)
import { upsertFiles } from "../slices/fileSlice";

import { setHasMore, setOldestMessageId } from "../slices/paginationSlice";
import { Navigate, replace, useNavigate, useOutletContext } from "react-router";

import SettingsPanel from "../components/SettingPanel";
import FriendRequests from "../components/FriendRequests";
import { useFriends } from "../hooks/useFriends";
import { useUser } from "../contextAPI/UserContext";
import IncomingCallModal from "../components/IncomingCallModal";
import OutgoingCallModal from "../components/OutgoingCallModal";
import { setParticipants, userJoined, userLeft } from "../slices/callSlice";
import AppLoader from "../components/AppLoader";
import { shallowEqual } from "react-redux";
import { store } from "../store";
import { useMemo } from "react";
import { useCallback } from "react";
import useMemoryMonitor from "../hooks/useMemoryMonitor";

import { useMessageSocket } from "../hooks/useMessageSocket";
import { useConversationSocket } from "../hooks/useConversationSocket";
import { useCallSocket } from "../hooks/useCallSocket";

const Chat = () => {
  //useMemoryMonitor(30000); // 5 saniyede bir ölçüm
  const activeConvRef = useRef(null);
  const {
    activeConversation,
    setActiveConversation,
    SOCKET_URL,
    showNotification,
  } = useOutletContext();

  const playNotificationSound = useCallback(() => {
    const audio = new Audio("/sounds/new-notification.mp3");
    audio.play().catch((error) => console.warn("🔇 Ses çalınamadı:", error));
  }, []);

  useEffect(() => {
    activeConvRef.current = activeConversation;
  }, [activeConversation]);
  const { user, setUser } = useUser();
  const userId = user?._id;
  //console.log("user: ", user);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (progress === 100) {
      setTimeout(() => {
        setReady(true);
      }, 600);
    }
  }, [progress, ready]);

  const dispatch = useDispatch();
  // Global state
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const conversations = useSelector(
    (s) => s.conversations.list || [],
    shallowEqual,
  );

  const messagesByConv = useSelector(
    (s) => s.messages?.byConversation,
    shallowEqual,
  );
  const filesByConv = useSelector((s) => s.files?.byKey, shallowEqual);
  const { requests, friends } = useSelector((state) => state.friends);
  const [spinner, setSpinner] = useState(false);

  //console.log(requests, friends);
  //console.log("pres: ", pres);
  //console.log("arkadaşlar: ", friends);
  //console.log("chatler: ", conversations);
  //console.log("files: ", filesByConv);
  //console.log("mesajlar: ", messagesByConv);
  //console.log("uis: ", uis);

  // UI state
  const [activePage, setActivePage] = useState("chatList");
  const navigate = useNavigate();
  // Yeni mesaj (after) fetch animasyonu için
  const fetchingNewRef = useRef(false);
  // Socket
  const { socket, status, isConnected } = useSocket(
    SOCKET_URL,
    userId,
    addOrUpdateConversations,
    conversations,
    friends,
    dispatch,
    setSpinner,
    setProgress,
  );

  useFriends({ socket, setProgress });

  useMessageSocket(socket, dispatch, activeConvRef, userId);
  useConversationSocket(
    socket,
    dispatch,
    activeConvRef,
    userId,
    playNotificationSound,
    showNotification,
  );
  useCallSocket(
    socket,
    dispatch,
    user,
    outgoingCall,
    setIncomingCall,
    setOutgoingCall,
    showNotification,
    navigate,
  );

  useEffect(() => {
    if (!activeConversation?._id) return;
    const fresh = conversations.find(
      (c) => String(c._id) === String(activeConversation?._id),
    );
    if (fresh) setActiveConversation(fresh);
  }, [activeConversation?._id, conversations]);
  // Aynı lastId için üst üste messages-after emit etmemek için guard
  const lastAfterSentRef = useRef({}); // { [convId]: lastAfterId }

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unread || 0), 0),
    [conversations],
  );

  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread})Chat` : "Chat";
  }, [totalUnread]);

  // === Presigned URL yenileme: ayrı effect (filesByConv bağımlı) ===
  useEffect(() => {
    if (!socket) return;
    const now = Date.now();

    const convId = activeConversation?._id;
    if (!convId) return;

    // 1) Mesaj dosyaları expired kontrolü
    const files = filesByConv[convId] || {};
    const expiredFileMsgIds = Object.entries(files)
      .filter(
        ([, f]) =>
          !f.media_url_expiresAt || new Date(f.media_url_expiresAt) <= now,
      )
      .map(([msgId]) => msgId);
    if (expiredFileMsgIds.length > 0) {
      socket.emit("pre-signature-files", {
        messageIds: expiredFileMsgIds,
        conversationId: convId,
      });
    }
  }, [socket, activeConversation?._id]);

  // === Konuşma değişince mesajları getir ===
  useEffect(() => {
    if (!socket) return;
    const convId = activeConversation?._id;
    if (!convId) return;

    // Konuşma değişiminde pagination'ı temiz başlat
    //dispatch(resetPaginationForConversation({ conversationId: convId }));

    const existing = messagesByConv[convId] || [];

    if (existing.length === 0 && !activeConversation._id.startsWith("_temp")) {
      // İlk kez açılıyor → en yeni mesajları çek

      socket.emit("messages", { conversationId: convId, limit: 5 });
      // after guard’ını sıfırla
      lastAfterSentRef.current[convId] = null;
    } else {
      // Varsa, yeni mesajları bir kere kontrol et (socket zaten canlı; bu sadece “gap” kapatır)
      const lastId = existing.at(-1)?._id;
      if (
        lastId &&
        lastAfterSentRef.current[convId] !== lastId &&
        !lastId.startsWith("tmp_")
      ) {
        fetchingNewRef.current = true; // after fetch başlıyor → spinner aç
        socket.emit("messages-after", {
          conversationId: convId,
          after: lastId,
          limit: 5,
        });

        lastAfterSentRef.current[convId] = lastId;
      }
      fetchingNewRef.current = false;
    }
  }, [socket, activeConversation?._id]); //ConvMessages

  // ————————————————— UI —————————————————

  const handleOption1Click = useCallback(() => {
    setActivePage("chatList");
  }, []);

  const handleFriendRequests = useCallback(() => {
    setActivePage("friendRequests");
  }, []);

  const handleOption3Click = useCallback(() => {
    setActivePage("option3");
  }, []);

  const handleOption4Click = useCallback(() => {
    setActivePage("option4");
  }, []);

  const handleSettings = useCallback(() => {
    setActivePage("profileSettings");
    setActiveConversation(null);
  }, [setActiveConversation]);

  if (!ready) return <AppLoader progress={progress} />;
  return (
    <>
      <title>Chat</title>
      <div className="chat-container container">
        {/* Chat Options */}
        <div
          className={`chat__options ${
            !activeConversation?._id ? "is-visible" : ""
          }`}
        >
          <div className="__top">
            <div className="option">
              <button
                className={`fa-solid fa-message ${
                  activePage !== "chatList" ? "" : "active"
                }`}
                id="option1"
                onClick={handleOption1Click}
              >
                <span className="count">{totalUnread}</span>
              </button>
            </div>
            <div className="option">
              <div className={`fa-request`}>
                <MdGroup
                  id="option2"
                  color="#A9B5BB"
                  onClick={handleFriendRequests}
                  className={`${
                    activePage !== "friendRequests" ? "" : "active"
                  }`}
                ></MdGroup>
                {requests.length > 0 ? (
                  <span className="count">{requests.length}</span>
                ) : null}
              </div>
            </div>
            <div className="option">
              <div className="disabled-tip">
                <button
                  className="fa-solid fa-comments "
                  id="option3"
                  onClick={handleOption3Click}
                />
              </div>
            </div>
            <div className="option">
              <div className="disabled-tip">
                <button
                  className="fa-solid fa-people-group"
                  id="option4"
                  onClick={handleOption4Click}
                />
              </div>
            </div>
          </div>
          <div className="__bottom">
            <div className="option">
              <div className="disabled-tip">
                <button
                  className="btn-dark fa-solid fa-gear"
                  id="option5"
                  onClick={handleSettings}
                />
              </div>
            </div>

            <div className="option">
              <MdPerson
                className={`profile-btn ${
                  activePage !== "profileSettings" ? "" : "active"
                }`}
                id="option6"
                onClick={handleSettings}
              ></MdPerson>
            </div>
          </div>
        </div>

        {/* Chat List */}
        {activePage === "chatList" && (
          <ChatList status={status} socket={socket} spinner={spinner} />
        )}

        {activePage === "friendRequests" && <FriendRequests socket={socket} />}
        {activePage === "option3" && <Option3 />}
        {activePage === "option4" && <Option4 />}
        {activePage === "profileSettings" && <ProfileSettings />}
        {/* Chat Panel */}
        {activePage === "chatList" ? (
          <ChatPanel
            socket={socket}
            fetchingNew={fetchingNewRef.current}
            isOnline={isConnected}
            setOutgoingCall={setOutgoingCall}
          />
        ) : (
          <SettingsPanel activePage={activePage} />
        )}
        <IncomingCallModal
          incomingCall={incomingCall}
          onAccept={() => {
            socket.emit(
              "call:create-or-join",
              {
                conversationId: incomingCall.conversationId,
                userId: user._id,
                callType: incomingCall.callType,
                conversationType: incomingCall.type,
                peers: [incomingCall.from, user._id],
              },
              (res) => {
                if (res.success && res.callId) {
                  socket.emit("call:accept", {
                    callId: res.callId,
                    userId: user._id,
                    callerId: incomingCall.from,
                  });

                  setIncomingCall(null);
                  navigate(`/call/${res.callId}`, {
                    state: { callerId: incomingCall.from },
                  });
                } else {
                  alert("Aramaya katılım başarısız oldu");
                }
              },
            );
          }}
          onReject={() => {
            if (incomingCall.type === "private") {
              socket.emit("call:reject", {
                callId: incomingCall.callId,
                userId: user._id,
                callerId: incomingCall.from, // backend'e callerId gönder
              });
            }
            setIncomingCall(null);
          }}
        />
        <OutgoingCallModal
          call={outgoingCall} // { callId, peerId, peerName?, callType }
          onCancel={() => {
            socket.emit("leave-call", {
              userId: user._id,
              callId: outgoingCall.callId,
            });
            setOutgoingCall(null);
          }}
        />
      </div>
    </>
  );
};

export default Chat;
