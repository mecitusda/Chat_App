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
import { updateConversationAvatars } from "../slices/conversationSlice";
// Conversations
import {
  addOrUpdateConversations,
  incrementUnread,
} from "../slices/conversationSlice";

// Messages
import { addOrUpdateMessages, applyMessageAck } from "../slices/messageSlice";

// Files (presigned URL yönetimi için)
import { upsertFiles } from "../slices/fileSlice";

import { setHasMore, setOldestMessageId } from "../slices/paginationSlice";
import { useOutletContext } from "react-router";

import SettingsPanel from "../components/SettingPanel";
import FriendRequests from "../components/FriendRequests";
import { useFriends } from "../hooks/useFriends";
import { useUser } from "../contextAPI/UserContext";

const playNotificationSound = () => {
  const audio = new Audio("/sounds/new-notification.mp3");
  audio.play().catch((error) => {
    console.warn("🔇 Ses çalınamadı:", error);
  });
};

const Chat = () => {
  const {
    activeConversation,
    setActiveConversation,
    SOCKET_URL,
    setResetEnabled,
    handleClick,
    resetEnabled,
    banner,
    setBanner,
    showNotification,
    activeConversationId,
    setactiveConversationId,
  } = useOutletContext();
  const { user, setUser } = useUser();
  const userId = user?._id;
  //console.log("user: ", user);

  const dispatch = useDispatch();
  // Global state

  const conversations = useSelector((s) => s.conversations.list || []);
  const messagesByConv = useSelector((s) => s.messages?.byConversation || {});
  const filesByConv = useSelector((s) => s.files?.byKey || {});
  const { requests, friends } = useSelector((state) => state.friends);
  const uis = useSelector((s) => s.ui.atBottomByConv || []);
  //console.log("arkadaşlar: ", friends);
  //console.log("chatler: ", conversations);
  //console.log("files: ", filesByConv);
  //console.log("mesajlar: ", messagesByConv);
  //console.log("uis: ", uis);

  // UI state
  const [activePage, setActivePage] = useState("chatList");

  // Yeni mesaj (after) fetch animasyonu için
  const [fetchingNew, setFetchingNew] = useState(false);

  // Socket
  const { socket, status, isConnected } = useSocket(
    SOCKET_URL,
    userId,
    addOrUpdateConversations,
    conversations,
    dispatch
  );

  useFriends({ socket, showNotification }); // socket listener’ları Redux’a bağlar

  useEffect(() => {
    if (!activeConversationId) return;
    const fresh = conversations.find(
      (c) => String(c._id) === String(activeConversationId)
    );
    if (fresh) setActiveConversation(fresh);
  }, [activeConversationId, conversations]);

  // Aynı lastId için üst üste messages-after emit etmemek için guard
  const lastAfterSentRef = useRef({}); // { [convId]: lastAfterId }

  function getTotalUnreadMessages() {
    return conversations.reduce((total, chat) => {
      return total + (chat.unread || 0); // unread değeri yoksa 0 kabul edilir
    }, 0);
  }

  if (getTotalUnreadMessages() > 0) {
    document.title = `(${getTotalUnreadMessages()})Chat`;
  } else {
    document.title = "Chat";
  }

  const activeAtBottom = useSelector((s) =>
    selectAtBottom(s, activeConversation?._id)
  );

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
  }, [socket, filesByConv, activeConversation?._id, user]);

  // === Socket listeners (tek sefer bağla) ===
  useEffect(() => {
    if (!socket) return;

    const handleMessageList = (newData) => {
      const arr = newData?.messages || [];
      const page = newData?.pageInfo || {};
      setFetchingNew(false);
      console.log("newData: ", newData);
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
      if (getTotalUnreadMessages() > 0) {
        document.title = `(${getTotalUnreadMessages()})Chat`;
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

    const handleAvatarPreUrls = (data) => {
      if (!data || typeof data !== "object") return;
      // backend 3600s veriyorsa küçük bir buffer bırak (5 dk)
      const NOW = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;
      const SAFETY_BUFFER = 5 * 60 * 1000; // 5 dakika buffer
      const DEFAULT_EXPIRES_AT = NOW + (ONE_HOUR - SAFETY_BUFFER);

      for (const [conversationId, items] of Object.entries(data)) {
        const files = (items || [])
          .filter(
            (it) =>
              it &&
              it.media_key &&
              (it.type === "avatar" || it.type === "conversation-avatar")
          )
          .map((it) => ({
            media_key: it.media_key,
            media_url: it.media_url,
            type: it.type,
            ownerUserId: it.ownerUserId,
            sourceConvId: it.sourceConvId,
            expiresAt: DEFAULT_EXPIRES_AT,
          }));

        if (files.length > 0) {
          //console.log("avatar güncellendi.");
          dispatch(upsertFiles({ conversationId, files }));
        }
      }
    };

    // const handleBgPreUrls = (data) => {
    //   if (!data || typeof data !== "object" || !user?._id) return;
    //   const userItems = data; // sadece kendin için kontrol et

    //   const NOW = Date.now();
    //   const ONE_HOUR = 60 * 60 * 1000;
    //   const SAFETY_BUFFER = 5 * 60 * 1000;
    //   const DEFAULT_EXPIRES_AT = NOW + (ONE_HOUR - SAFETY_BUFFER);

    //   setUser((prev) => ({
    //     ...prev,
    //     settings: {
    //       ...prev.settings,
    //       chatBgImageUrl: data[0].media_url,
    //       expiresAt: DEFAULT_EXPIRES_AT,
    //     },
    //   }));
    // };

    // 🔧 DÜZELTİLEN KISIM

    const handleStatusUpdate = ({
      messageId,
      messageIds,
      conversationId,
      action,
      by,
      at,
    }) => {
      // Sunucu 'status' gönderiyor ("delivered" | "read")
      const ids = messageId ? [messageId] : messageIds || [];
      if (ids.length === 0) return;
      console.log("mesaj değişmeli: ", ids);
      dispatch(
        applyMessageAck({
          conversationId: conversationId || activeConversation?._id, // yoksa aktif sohbete yaz
          messageIds: ids,
          actionType: action, // <- action yerine status kullan
          by,
          at: at || Date.now(), // sunucu at göndermediyse şimdi
        })
      );
    };

    const handleUpdatedAvatars = ({ updates }) => {
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
  }, [socket, dispatch, activeConversation?._id]);

  // === Konuşma değişince mesajları getir ===
  useEffect(() => {
    if (!socket) return;
    const convId = activeConversation?._id;
    if (!convId) return;

    // Konuşma değişiminde pagination'ı temiz başlat
    //dispatch(resetPaginationForConversation({ conversationId: convId }));

    const existing = messagesByConv[convId] || [];

    if (existing.length === 0) {
      // İlk kez açılıyor → en yeni mesajları çek
      socket.emit("messages", { conversationId: convId, limit: 20 });
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
        setFetchingNew(true); // after fetch başlıyor → spinner aç
        socket.emit("messages-after", {
          conversationId: convId,
          after: lastId,
          limit: 20,
        });

        lastAfterSentRef.current[convId] = lastId;
      }
      setFetchingNew(false);
    }
  }, [socket, activeConversation?._id, messagesByConv]);

  useEffect(() => {
    if (!socket) return;

    const handleChatlistUpdate = (r) => {
      const convId = r.data._id;
      const isActiveConv = String(convId) === String(activeConversation?._id);
      const panelAtBottom = isActiveConv ? activeAtBottom : false;
      const isTabVisible = document.visibilityState === "visible";
      const isFromOther = r.data?.last_message?.sender?._id !== userId;
      console.log(
        "isavtive: ,",
        isActiveConv,
        "panel bottom:",
        panelAtBottom,
        "istabvisible:",
        isTabVisible,
        "isFrom other"
      );
      dispatch(addOrUpdateConversations([r.data]));
      console.log("dönen chat", r.data);
      if (
        isFromOther &&
        (!isActiveConv || !panelAtBottom || !isTabVisible) &&
        r.data.last_message.message._id !== undefined
      ) {
        const increment = r.data?.last_message?.sender._id !== userId ? 1 : 0;
        if (increment === 1) {
          dispatch(
            incrementUnread({
              conversationId: convId,
              by: 1,
            })
          );
        }
      }
      console.log("yeni mesaj geldi");
      console.log("karşı taraftan mı mesaj: ", isFromOther);
      if (isFromOther) {
        // panelAtBottom && isTabVisible && eski if içerideydi burası
        console.log("socketa bildirildi.");
        socket.emit("message:delivered", {
          messageId: r.data?.last_message.message._id,
          conversationId: r.data._id,
          userId,
        });
      }
      if (r.message === "send-message") {
        playNotificationSound();
      }
      console.log(r);
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
  }, [socket, activeConversation?._id, dispatch, userId, activeAtBottom]);

  // ————————————————— UI —————————————————
  const handleOption1Click = () => setActivePage("chatList");
  const handleFriendRequests = () => setActivePage("friendRequests");
  const handleOption3Click = () => setActivePage("option3");
  const handleOption4Click = () => setActivePage("option4");
  const handleSettings = () => {
    setActivePage("profileSettings");
    setactiveConversationId(null);
  };
  return (
    <>
      <title>Chat</title>

      <div className="chat-container container">
        {/* Chat Options */}
        <div
          className={`chat__options ${
            !activeConversationId ? "is-visible" : ""
          }`}
        >
          <div className="__top">
            <div className="option">
              <button
                className="fa-solid fa-message"
                id="option1"
                onClick={handleOption1Click}
              >
                <span className="count">{getTotalUnreadMessages()}</span>
              </button>
            </div>
            <div className="option">
              <button
                className="fa-solid fa-bullseye fa-request"
                id="option2"
                onClick={handleFriendRequests}
              >
                {requests.length > 0 ? (
                  <span className="count">{requests.length}</span>
                ) : null}
              </button>
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
              <button
                className="btn-dark fa-solid fa-circle-user"
                id="option6"
                onClick={handleSettings}
              />
            </div>
          </div>
        </div>

        {/* Chat List */}
        {activePage === "chatList" && (
          <ChatList
            conversations={conversations}
            userId={userId}
            setactiveConversationId={setactiveConversationId}
            activeConversationId={activeConversationId}
            status={status}
            messagesByConv={messagesByConv}
            socket={socket}
            setActiveConversation={setActiveConversation}
            showNotification={showNotification}
            activeConversation={activeConversation}
          />
        )}
        {activePage === "friendRequests" && (
          <FriendRequests socket={socket} showNotification={showNotification} />
        )}
        {activePage === "option3" && <Option3 />}
        {activePage === "option4" && <Option4 />}
        {activePage === "profileSettings" && (
          <ProfileSettings
            socket={socket}
            showNotification={showNotification}
            activePage={activePage}
          />
        )}
        {/* Chat Panel */}
        {activePage === "chatList" ? (
          <ChatPanel
            messages={messagesByConv}
            activeConversation={activeConversation}
            fileS={filesByConv}
            userId={userId}
            socket={socket}
            fetchingNew={fetchingNew} // 👈 yeni mesaj animasyonu için
            isOnline={isConnected}
            setActiveConversation={setActiveConversation}
            setactiveConversationId={setactiveConversationId}
          />
        ) : (
          <SettingsPanel activePage={activePage} />
        )}
      </div>
      <button
        className="reset"
        onClick={() => {
          setResetEnabled(true);
          handleClick();
          showNotification("Veriler silindi.");
        }}
        disabled={!resetEnabled}
      >
        {resetEnabled ? "DO NOT PRESS" : "YETER DAHA BASMA SAYFA YENİLE"}
      </button>
    </>
  );
};

export default Chat;
