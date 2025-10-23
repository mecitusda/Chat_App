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

const Chat = () => {
  useMemoryMonitor(5000); // 5 saniyede bir ölçüm
  const activeConvRef = useRef(null);
  const {
    activeConversation,
    setActiveConversation,
    SOCKET_URL,
    showNotification,
    activeConversationId,
    setactiveConversationId,
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
    shallowEqual
  );

  const messagesByConv = useSelector(
    (s) => s.messages?.byConversation,
    shallowEqual
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
    setProgress
  );

  useFriends({ socket, setProgress }); // socket listener’ları Redux’a bağlar

  useEffect(() => {
    if (!activeConversationId) return;
    const fresh = conversations.find(
      (c) => String(c._id) === String(activeConversationId)
    );
    if (fresh) setActiveConversation(fresh);
  }, [activeConversationId, conversations]);
  // Aynı lastId için üst üste messages-after emit etmemek için guard
  const lastAfterSentRef = useRef({}); // { [convId]: lastAfterId }

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unread || 0), 0),
    [conversations]
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
          !f.media_url_expiresAt || new Date(f.media_url_expiresAt) <= now
      )
      .map(([msgId]) => msgId);
    if (expiredFileMsgIds.length > 0) {
      socket.emit("pre-signature-files", {
        messageIds: expiredFileMsgIds,
        conversationId: convId,
      });
    }
  }, [socket, activeConversation?._id]);

  // === Socket listeners (tek sefer bağla) ===
  useEffect(() => {
    if (!socket) return;

    const handleMessageList = (newData) => {
      const arr = newData?.messages || [];
      const page = newData?.pageInfo || {};
      fetchingNewRef.current = false;
      const convId =
        newData.conversationId ||
        arr[0]?.conversation ||
        activeConversation?._id;
      if (!convId) return;

      if (typeof page.hasMoreBefore === "boolean") {
        dispatch(
          setHasMore({ conversationId: convId, hasMore: page.hasMoreBefore })
        );
      }
      if (arr.length === 0) return;
      //console.log("yeni mesaj eklendi. ", newData.text);
      const direction = page.before ? "prepend" : "append";
      dispatch(
        addOrUpdateMessages({
          conversationId: convId,
          messages: arr,
          direction,
        })
      );

      const oldest = arr[0]?._id || null;
      if (oldest) {
        dispatch(
          setOldestMessageId({ conversationId: convId, messageId: oldest })
        );
      }

      const minimal = arr
        .filter((m) => m && m.type !== "text" && m.media_url)
        .reduce((acc, m) => {
          acc[m._id] = {
            media_url: m.media_url,
            media_url_expiresAt: m.media_url_expiresAt,
          };
          return acc;
        }, {});
      //console.log("minimal: ", minimal);
      if (minimal) {
        //console.log("dosyayı ekliyor.");
        dispatch(upsertFiles({ conversationId: convId, files: minimal }));
      }

      //console.log("arr: ", arr);
      // (opsiyonel) burada tek tek delivered tetikliyorsun; sunucu tarafında batch zaten yapıyorsan kaldırabilirsin:
      const toDeliver = arr
        .filter((m) => String(m?.sender?._id || m?.sender) !== String(userId))
        .filter(
          (m) =>
            !(m.deliveredTo || []).some(
              (x) => String(x.user?._id || x.user) === String(userId)
            )
        )
        .map((m) => m._id);
      //console.log("todeliver: ", toDeliver);
      toDeliver.forEach((id) => {
        socket.emit("message:delivered", {
          messageId: id,
          conversationId: convId,
          userId,
        });
      });
      if (totalUnread > 0) {
        document.title = `(${totalUnread})Chat`;
      } else {
        document.title = "Chat";
      }
    };

    const handlePreUrls = ({ urls, conversationId }) => {
      const TTL_MS = 10 * 60 * 1000; // 10 dk (backend ile aynı süre)

      const enriched = (urls || []).reduce((acc, u) => {
        acc[u.messageId] = {
          media_url: u.media_url,
          media_url_expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
        };
        return acc;
      }, {});

      if (Object.keys(enriched).length > 0) {
        dispatch(upsertFiles({ conversationId, files: enriched }));
      }
    };

    // const handleAvatarPreUrls = (data) => {
    //   if (!data || typeof data !== "object") return;
    //   // backend 3600s veriyorsa küçük bir buffer bırak (5 dk)
    //   const NOW = Date.now();
    //   const ONE_HOUR = 60 * 60 * 1000;
    //   const SAFETY_BUFFER = 5 * 60 * 1000; // 5 dakika buffer
    //   const DEFAULT_EXPIRES_AT = NOW + (ONE_HOUR - SAFETY_BUFFER);

    //   for (const [conversationId, items] of Object.entries(data)) {
    //     const files = (items || [])
    //       .filter(
    //         (it) =>
    //           it &&
    //           it.media_key &&
    //           (it.type === "avatar" || it.type === "conversation-avatar")
    //       )
    //       .map((it) => ({
    //         media_key: it.media_key,
    //         media_url: it.media_url,
    //         type: it.type,
    //         ownerUserId: it.ownerUserId,
    //         sourceConvId: it.sourceConvId,
    //         expiresAt: DEFAULT_EXPIRES_AT,
    //       }));

    //     if (files.length > 0) {
    //       //console.log("avatar güncellendi.");
    //       dispatch(upsertFiles({ conversationId, files }));
    //     }
    //   }
    // };
    // // 🔧 DÜZELTİLEN KISIM

    const handleStatusUpdate = ({
      messageId,
      messageIds,
      conversationId,
      action,
      by,
      at,
    }) => {
      const conv = activeConvRef.current;
      // Sunucu 'status' gönderiyor ("delivered" | "read")
      const ids = messageId ? [messageId] : messageIds || [];
      if (ids.length === 0) return;
      //console.log("mesaj değişmeli: ", ids);
      dispatch(
        applyMessageAck({
          conversationId: conversationId || conv?._id, // yoksa aktif sohbete yaz
          messageIds: ids,
          actionType: action, // <- action yerine status kullan
          by,
          at: at || Date.now(), // sunucu at göndermediyse şimdi
        })
      );
    };

    const handleUpdatedAvatars = ({ updates }) => {
      //console.log("updates: ", updates);
      // updates: [{ type, conversationId, avatar }, { type, conversationId, userId, avatar }]
      dispatch(updateConversationAvatars(updates));
    };

    socket.on("messageList", handleMessageList);
    socket.on("pre-urls", handlePreUrls);
    socket.on("conversation-avatars-updated", handleUpdatedAvatars);
    //socket.on("pre-avatars", handleAvatarPreUrls);

    // socket.on("pre-bgImages", handleBgPreUrls);
    socket.on("message:status-update", handleStatusUpdate);

    return () => {
      socket.off("messageList", handleMessageList);
      socket.off("pre-urls", handlePreUrls);
      //socket.off("pre-avatars", handleAvatarPreUrls);
      // socket.off("pre-bgImages", handleBgPreUrls);
      socket.off("conversation-avatars-updated", handleUpdatedAvatars);
      socket.off("message:status-update", handleStatusUpdate);
    };
    // aktif konuşma değişirse fallback convId güncel kalsın:
  }, [socket]);

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

  useEffect(() => {
    if (!socket) return;

    const handleChatlistUpdate = (r) => {
      const currentActive = activeConvRef.current; // 👈 ref'ten al
      const convId = r.data._id;
      const isActiveConv = String(convId) === String(currentActive?._id);
      const panelAtBottom = isActiveConv
        ? selectAtBottom(store.getState(), currentActive?._id)
        : false;
      const isTabVisible = document.visibilityState === "visible";
      const isFromOther = r.data?.last_message?.sender?._id !== userId;
      const myUnread = r.data?.members.find((m) => m.user._id === userId);

      dispatch(addOrUpdateConversations([r.data]));
      console.log(!r.data?.last_message, r.data?.last_message);
      if (
        !r.data?.last_message?._id ||
        (isFromOther &&
          (!isActiveConv || !panelAtBottom || !isTabVisible) &&
          r.data.last_message?.message?._id !== undefined)
      ) {
        dispatch(setUnread({ conversationId: convId, by: myUnread.unread }));
      }
      if (isFromOther) {
        // panelAtBottom && isTabVisible && eski if içerideydi burası
        console.log("socketa bildirildi.");
        socket.emit("message:delivered", {
          messageId: r?.data?.last_message?.message?._id,
          conversationId: r?.data?._id,
          userId,
        });
      }
      if (r.message === "send-message") {
        playNotificationSound();
      }
      if (r.message === "group-created") {
        console.log(r.data);
        showNotification(
          `🔔${r.data.createdBy.username} sizi "${r.data.name}" grubuna ekledi.`
        );
      }
    };

    socket.on("chatList:update", handleChatlistUpdate);

    return () => {
      socket.off("chatList:update", handleChatlistUpdate);
    };
  }, [socket, dispatch, userId, showNotification]);

  useEffect(() => {
    if (!socket) return;

    // 📥 Biri arama başlattı → modal aç
    socket.on(
      "call:incoming",
      ({ callId, conversationId, from, type, callType }) => {
        setIncomingCall({
          callId,
          conversationId,
          from,
          type, // "group" | "private"
          callType, // "video" | "audio"
        });
      }
    );

    socket.on("call:accepted", ({ callId, by }) => {
      if (outgoingCall && outgoingCall.callId === callId) {
        console.log("karşı taraf kabul etti.", { callId, by });
        socket.emit(
          "call:create-or-join",
          {
            conversationId: outgoingCall.conversationId, // bunu setOutgoingCall içinde saklamalısın
            userId: user._id,
            callType: "video",
            conversationType: "private",
            peers: [outgoingCall.peerId, user._id],
          },
          (res) => {
            console.log("giriş yapılıyor.", res);
            if (res.success && res.callId) {
              navigate(`/call/${res.callId}`, {
                state: { callerId: user._id },
              });
              setOutgoingCall(null);
            }
          }
        );
      }
    });

    socket.on("call:rejected", ({ callId, by }) => {
      if (outgoingCall && outgoingCall.callId === callId) {
        showNotification(`📴 Kullanıcı ${by} aramayı reddetti.`);
        setOutgoingCall(null);
      }
    });

    socket.on("call:participants", ({ callId, participants }) => {
      console.log("📡 call:participants", callId, participants);
      dispatch(setParticipants({ callId, participants }));
    });

    // 🔹 2) Bir kullanıcı odaya katıldı (call içindekilere)
    socket.on("call:user-joined", ({ userId, callId }) => {
      console.log("📡 call:user-joined", userId);
      dispatch(userJoined({ callId, userId }));
    });

    // 🔹 3) Bir kullanıcı odadan ayrıldı (call içindekilere)
    socket.on("call:user-left", ({ userId, callId }) => {
      console.log("📡 call:user-left", userId);
      dispatch(userLeft({ callId, userId }));
    });

    socket.on(
      "call:update",
      ({ action, triggerUserId, conversationId, active_call }) => {
        console.log("📞 call:update geldi", {
          action,
          conversationId,
          active_call,
        });
        dispatch(
          updateConversationCall({
            conversationId,
            active_call,
            action,
            triggerUserId,
          })
        );
      }
    );

    return () => {
      socket.off("call:incoming");
      socket.off("call:accepted");
      socket.off("call:rejected");
      socket.off("call:participants");
      socket.off("call:user-joined");
      socket.off("call:user-left");
    };
  }, [socket, outgoingCall, user, navigate]);

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
    setactiveConversationId(null);
  }, [setactiveConversationId]);

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
            fetchingNew={fetchingNewRef.current} // 👈 yeni mesaj animasyonu için
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
                conversationType: incomingCall.type, // "private"
                peers: [incomingCall.from, user._id],
              },
              (res) => {
                if (res.success && res.callId) {
                  // ✅ Caller’a “accepted” bildir
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
              }
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
