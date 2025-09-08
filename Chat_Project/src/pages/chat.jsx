// pages/Chat.jsx
import React, { useEffect, useRef, useState } from "react";
import ChatList from "../components/Chat_List";
import Option2 from "../components/Option2";
import Option3 from "../components/Option3";
import Option4 from "../components/Option4";
import ChatPanel from "../components/ChatPanel";
import { useSocket } from "../hooks/useSocket";
import { useDispatch, useSelector } from "react-redux";
import { selectAtBottom } from "../slices/uiSlice";
// Conversations
import {
  addOrUpdateConversations,
  setConversations,
  incrementUnread,
  setUnread,
  // setConversations,
  resetConversation,
} from "../slices/conversationSlice";

// Messages
import {
  addOrUpdateMessages,
  applyMessageAck,
  // setMessages,
  resetMessages,
} from "../slices/messageSlice";

// Files (presigned URL yönetimi için)
import {
  setFiles,
  upsertFiles,
  // setFiles,
  resetFile,
} from "../slices/fileSlice";

// Pagination (before yönü)
import {
  setHasMore,
  setOldestMessageId,
  resetPaginationForConversation,
  // resetAllPagination,
} from "../slices/paginationSlice";
import { useOutletContext } from "react-router";
import { useUserId } from "../contextAPI/UserContext";

const Chat = () => {
  const { activeConversation, setActiveConversation, SOCKET_URL } =
    useOutletContext();
  const userId = useUserId().userId;

  const dispatch = useDispatch();

  // Global state
  const conversations = useSelector((s) => s.conversations?.list || []);
  const messagesByConv = useSelector((s) => s.messages?.byConversation || {});
  const filesByConv = useSelector((s) => s.files?.byKey || {});
  const uis = useSelector((s) => s.ui.atBottomByConv || []);
  //console.log("mesajlar: ", messagesByConv);
  //console.log("chatler: ", conversations);
  //console.log("files: ", filesByConv);
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
    conversations
  );

  // Aynı lastId için üst üste messages-after emit etmemek için guard
  const lastAfterSentRef = useRef({}); // { [convId]: lastAfterId }

  function getTotalUnreadMessages(coversations) {
    return conversations.reduce((total, chat) => {
      return total + (chat.unread || 0); // unread değeri yoksa 0 kabul edilir
    }, 0);
  }

  const activeAtBottom = useSelector((s) =>
    selectAtBottom(s, activeConversation?._id)
  );
  // === Socket listeners (tek sefer bağla) ===
  useEffect(() => {
    if (!socket) return;

    const handleMessageList = (newData) => {
      const arr = newData?.messages || [];
      const page = newData?.pageInfo || {};
      if (page.after) setFetchingNew(false);

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
        .filter((m) => m && m.type !== "text" && m.media_key)
        .map((m) => ({ media_key: m.media_key }));
      if (minimal.length)
        dispatch(upsertFiles({ conversationId: convId, files: minimal }));
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
    };

    const handlePreUrls = ({ urls, conversationId }) => {
      const TTL_MS = 60 * 60 * 1000;
      const enriched = (urls || []).map((u) => ({
        media_key: u.media_key,
        media_url: u.media_url,
        expiresAt: Date.now() + TTL_MS,
      }));
      if (enriched.length > 0) {
        dispatch(upsertFiles({ conversationId, files: enriched }));
      }
    };

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

    socket.on("messageList", handleMessageList);
    socket.on("pre-urls", handlePreUrls);
    socket.on("message:status-update", handleStatusUpdate);

    return () => {
      socket.off("messageList", handleMessageList);
      socket.off("pre-urls", handlePreUrls);
      socket.off("message:status-update", handleStatusUpdate);
    };
    // aktif konuşma değişirse fallback convId güncel kalsın:
  }, [socket, dispatch, activeConversation?._id, userId]);

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
      socket.emit("messages", { conversationId: convId, limit: 2 });
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
          limit: 2,
        });
        lastAfterSentRef.current[convId] = lastId;
      }
    }
  }, [socket, activeConversation?._id, dispatch, messagesByConv]);

  // === Presigned URL yenileme: ayrı effect (filesByConv bağımlı) ===
  useEffect(() => {
    if (!socket) return;
    const convId = activeConversation?._id;
    if (!convId) return;

    const now = Date.now();
    const files = filesByConv[convId] || [];
    const expiredKeys = files
      .filter((f) => !f.expiresAt || f.expiresAt <= now)
      .map((f) => f.media_key);

    if (expiredKeys.length > 0) {
      socket.emit("pre-signature-file", {
        mediaKeys: expiredKeys,
        conversationId: convId,
      });
    }
  }, [socket, activeConversation?._id, filesByConv]);

  useEffect(() => {
    if (!socket) return;

    const handleChatlistUpdate = (data) => {
      const convId = data._id;
      const isActiveConv = String(convId) === String(activeConversation?._id);
      const panelAtBottom = isActiveConv ? activeAtBottom : false;
      const isTabVisible = document.visibilityState === "visible";
      const isFromOther = data?.last_message?.sender?._id !== userId;

      dispatch(addOrUpdateConversations([data]));

      if (isFromOther && (!isActiveConv || !panelAtBottom || !isTabVisible)) {
        dispatch(
          incrementUnread({
            conversationId: convId,
            by: data?.last_message.sender._id !== userId ? 1 : 0,
          })
        );
      }

      if (isActiveConv && panelAtBottom && isTabVisible && isFromOther) {
        socket.emit("message:delivered", {
          messageId: data?.last_message.message._id,
          conversationId: data._id,
          userId,
        });
      }
    };

    socket.on("chatList:update", handleChatlistUpdate);

    return () => {
      socket.off("chatList:update", handleChatlistUpdate);
    };
  }, [socket, activeConversation?._id, dispatch, userId, activeAtBottom]);

  // ————————————————— UI —————————————————
  const handleOption1Click = () => setActivePage("chatList");
  const handleOption2Click = () => setActivePage("option2");
  const handleOption3Click = () => setActivePage("option3");
  const handleOption4Click = () => setActivePage("option4");

  return (
    <>
      <title>Chat</title>
      <div className="chat-container container">
        {/* Chat Options */}
        <div className="chat__options">
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
                className="fa-solid fa-bullseye"
                id="option2"
                onClick={handleOption2Click}
              />
            </div>
            <div className="option">
              <button
                className="fa-solid fa-comments"
                id="option3"
                onClick={handleOption3Click}
              />
            </div>
            <div className="option">
              <button
                className="fa-solid fa-people-group"
                id="option4"
                onClick={handleOption4Click}
              />
            </div>
          </div>
          <div className="__bottom">
            <div className="option">
              <button
                className="btn-dark fa-solid fa-gear"
                id="option5"
                onClick={handleOption1Click}
              />
            </div>
            <div className="option">
              <button
                className="btn-dark fa-solid fa-circle-user"
                id="option6"
                onClick={handleOption2Click}
              />
            </div>
          </div>
        </div>

        {/* Chat List */}
        {activePage === "chatList" && (
          <ChatList
            conversations={conversations}
            userId={userId}
            setActiveConversation={setActiveConversation}
            status={status}
          />
        )}
        {activePage === "option2" && <Option2 />}
        {activePage === "option3" && <Option3 />}
        {activePage === "option4" && <Option4 />}

        {/* Chat Panel */}
        <ChatPanel
          messages={messagesByConv}
          activeConversation={activeConversation}
          fileS={filesByConv}
          userId={userId}
          socket={socket}
          fetchingNew={fetchingNew} // 👈 yeni mesaj animasyonu için
          isOnline={isConnected}
        />
      </div>
    </>
  );
};

export default Chat;
