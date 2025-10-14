import React, { useEffect, useRef, useState, useCallback } from "react";
import ChatHeader from "./ChatPanel_Header";
import { FiLoader, FiCheck } from "react-icons/fi";
import { FaCheckDouble } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import { computeEffectiveStatus } from "../helpers/effectiveStatus";
import {
  selectHasMore,
  selectOldestMessageId,
} from "../slices/paginationSlice";
import MediaLightbox from "./MediaLightbox";
import ChatInput from "./ChatInput";
import {
  addOptimisticMessage,
  replaceTempMessage,
  applyMessageAck,
} from "../slices/messageSlice";
import { useTyping } from "../hooks/useTyping";
import { resetUnread, updatedLastReadId } from "../slices/conversationSlice";
import { setAtBottom } from "../slices/uiSlice";
import { upsertFiles } from "../slices/fileSlice";
import ProfileDrawer from "../components/ProfileDrawer";
import { useUser } from "../contextAPI/UserContext";
import { useInView } from "react-intersection-observer";
import Avatar from "@mui/material/Avatar";
import { RiCheckDoubleFill } from "react-icons/ri";
/* ------ Mesaj durum ikonu (aggregate) ------ */
function getStatusIconByStatus(status) {
  switch (status) {
    case "sending":
      return <FiLoader className="icon icon--sending" />;
    case "sent":
      return <FiCheck className="icon icon--sent" />;
    case "delivered":
      return <RiCheckDoubleFill className="icon icon--delivered" />;
    case "read":
      return <RiCheckDoubleFill className="icon icon--read" />;
    default:
      return null;
  }
}

function getSender_Avatar(msg, members) {
  const member = members.filter((m) => m.user._id === msg.sender);
  return member[0]?.user?.avatar?.url;
}

function getSender_Name(msg, members) {
  const member = members.filter((m) => m.user._id === msg.sender);
  return member[0]?.user?.username;
}

/* ------ Saat formatı ------ */
function formatToHour(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

/* ------ Yardımcılar: tür/isim çıkarma ------ */
function extFromUrl(url = "") {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    const m = path.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
    return m ? m[1] : "";
  } catch {
    const m = (url || "").toLowerCase().match(/\.([a-z0-9]+)(?:\?|#|$)/i);
    return m ? m[1] : "";
  }
}

function classifyType({ msgType, mime, url }) {
  const t = (msgType || "").toLowerCase();
  const m = (mime || "").toLowerCase();
  const ext = extFromUrl(url);

  if (t === "image") return "image";
  if (t === "video") return "video";
  if (t === "audio") return "audio";
  if (t === "file" || t === "document") return "document";
  if (t && t !== "text") return t;

  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m) return "document";

  const imgExt = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg", "avif"];
  const vidExt = ["mp4", "webm", "mov", "m4v", "ogg", "ogv"];
  const audExt = ["mp3", "wav", "ogg", "m4a", "aac", "flac"];
  const docExt = [
    "pdf",
    "doc",
    "docx",
    "ppt",
    "pptx",
    "xls",
    "xlsx",
    "csv",
    "txt",
    "zip",
    "rar",
    "7z",
  ];

  if (imgExt.includes(ext)) return "image";
  if (vidExt.includes(ext)) return "video";
  if (audExt.includes(ext)) return "audio";
  if (docExt.includes(ext)) return "document";
  return "unknown";
}

function filenameFromUrl(url = "") {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname.split("/").pop() || "dosya");
  } catch {
    const parts = url.split("/");
    return decodeURIComponent(parts.pop() || "dosya");
  }
}

// en alta yakın mı?
function isNearBottom(el, px = 40) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= px;
}

// okunduya işaretlenecek (benim göndermediğim ve HENÜZ ben okumamışsam)
function collectUnseen(convMessages, meId) {
  return (convMessages || [])
    .filter((m) => String(m?.sender?._id || m?.sender) !== String(meId))
    .filter((m) => {
      const readBy = Array.isArray(m.readBy) ? m.readBy : [];
      const meRead = readBy.some(
        (x) => String(x?.user?._id ?? x?.user) === String(meId)
      );
      return !meRead;
    })
    .map((m) => m._id)
    .filter(Boolean);
}

function getHeaderAvatarKey(conversation, selfId) {
  if (!conversation) return undefined;
  if (conversation.type === "private") {
    const meFirst = conversation?.members?.[0]?.user?._id === selfId;
    const other = meFirst
      ? conversation?.members?.[1]?.user
      : conversation?.members?.[0]?.user;
    return other?.avatar?.url; // media_key
  }
  return conversation?.avatar.url; // group media_key
}
/* ------------------------------------------------------------------ */
/* 1) Per-message alt component: Hook'lar burada!                      */
/* ------------------------------------------------------------------ */
function VisibleMessage({
  msg,
  index,
  isMe,
  onVisible, // parent'tan batch okuma için
  renderMessageMedia, // parent fonksiyonu (varsa)
  computeStatus, // (m) => status
  isCurrentMatch, // arama highlight
  conversation,
  isAvatar,
  isName,
}) {
  const { ref, inView } = useInView({ threshold: 0.7, triggerOnce: true });
  const metaRef = useRef(null);
  const [metaWidth, setMetaWidth] = useState(0);
  useEffect(() => {
    if (metaRef.current) {
      setMetaWidth(metaRef.current.offsetWidth);
    }
  }, [msg.text, msg.createdAt, isMe]); // mesaj değişince tekrar ölç
  useEffect(() => {
    if (!metaRef.current) return;
    const observer = new ResizeObserver(() => {
      setMetaWidth(metaRef.current.offsetWidth);
    });
    observer.observe(metaRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (inView && !isMe && msg?._id) onVisible(msg._id);
  }, [inView, isMe, msg?._id, onVisible]);

  const hasMedia = msg.type !== "text" && msg.media_url;

  return (
    <div
      ref={ref}
      className={`message message--${isMe ? "outgoing" : "incoming"} ${
        isCurrentMatch ? "message--highlight" : ""
      } ${isName && !isMe ? "mb-06" : ""}`}
      data-msg-index={index}
    >
      {!isMe && isAvatar && (
        <Avatar
          alt="Remy Sharp"
          src={getSender_Avatar(msg, conversation.members)}
          className="avatar"
        />
      )}
      {hasMedia && renderMessageMedia?.(msg)}
      <div className="message__content">
        {msg.text && (
          <>
            <span className="message__text">{msg.text}</span>
          </>
        )}
        <span className="message__spacer" style={{ width: metaWidth }}></span>{" "}
        {/* boşluk için */}
        <div className="message__meta" ref={metaRef}>
          <span className="message__time">{formatToHour(msg.createdAt)}</span>
          {isMe && (
            <span className="message__status">
              {getStatusIconByStatus(computeStatus?.(msg))}
            </span>
          )}
        </div>
      </div>
      {isName && !isMe && (
        <div className="sender">
          {getSender_Name(msg, conversation.members)}
        </div>
      )}
    </div>
  );
}

const ChatPanel = ({
  activeConversation,
  userId,
  fileS,
  socket,
  fetchingNew,
  isOnline,
  setActiveConversation,
  setactiveConversationId,
  setOutgoingCall,
  showNotification,
}) => {
  //console.log("messages: ", messages);
  const { user, setUser } = useUser();
  const convId = activeConversation?._id;
  const dispatch = useDispatch();
  let beforeMessage = null;
  const listRef = useRef(null);
  const hasMoreOlder = useSelector((s) =>
    convId ? selectHasMore(s, convId) : true
  );
  const oldestId = useSelector((s) =>
    convId ? selectOldestMessageId(s, convId) : null
  );

  const [loadingOlder, setLoadingOlder] = useState(false);
  const prevScrollHeightRef = useRef(0);
  const prevScrollTopRef = useRef(0);
  const pendingBeforeIdRef = useRef(null);

  const touchStartYRef = useRef(0);
  const hasTriggeredPullRef = useRef(false);

  const convMessages = useSelector(
    (s) => s.messages?.byConversation[activeConversation?._id] || []
  );
  const canLoadOlder = !!isOnline && !!hasMoreOlder;

  const outboxRef = useRef(new Map()); // tempId -> message
  //console.log("mesajlar:", convMessages);
  /* read throttle/guard */

  /* ------ Typing: sadece hook ------ */
  const activeTypers = useTyping(socket, convId);

  /* ------ Lightbox ------ */
  const [isLightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // “altta mıyım?”
  const [isAtBottom, setIsAtBottom] = useState(true);

  //Skip
  const endRef = useRef(null);
  const wasAtBottomRef = useRef(true);
  const isPrependingRef = useRef(false);

  //Profile
  const [isProfileOpen, setProfileOpen] = useState(false);

  //file Prev
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);

  const background = user?.settings?.chatBgImage || user?.settings?.chatBgColor;

  //Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]); // array of message indices
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  useEffect(() => {
    if (!socket || !convId) return;
    socket.emit("watch-conversation", { conversationId: convId });
    setSearchQuery(null);
  }, [socket, activeConversation?._id]);

  /* Görünen yeni gelen mesajları DELIVERED yap (deliveredTo listesine göre) */
  useEffect(() => {
    if (!socket || !convId) return;
    if (!convMessages?.length) return;

    const toDeliver = convMessages
      .filter((m) => String(m?.sender?._id || m?.sender) !== String(userId))
      .filter(
        (m) =>
          !(m.deliveredTo || []).some(
            (x) => String(x.user?._id || x.user) === String(userId)
          )
      )
      .map((m) => m._id);
    //console.log("convMesages: ", convMessages, userId, toDeliver);
    toDeliver.forEach((id) => {
      socket.emit("message:delivered", {
        messageId: id,
        conversationId: convId,
        userId,
      });
    });
  }, [socket, convId, convMessages, userId]);

  /* Eski mesajları getir + pozisyon koru */
  const loadOlder = useCallback(() => {
    const el = listRef.current;
    if (!el || loadingOlder || !hasMoreOlder || !convId || !isOnline) return;

    const firstId = oldestId || convMessages?.[0]?._id;
    if (!firstId) return;

    setLoadingOlder(true);
    pendingBeforeIdRef.current = firstId;

    prevScrollHeightRef.current = el.scrollHeight;
    prevScrollTopRef.current = el.scrollTop;
    isPrependingRef.current = true;
    socket?.emit("messages-before", {
      conversationId: convId,
      before: firstId,
      limit: 20,
    });
  }, [
    convId,
    convMessages,
    socket,
    loadingOlder,
    hasMoreOlder,
    oldestId,
    isOnline,
  ]);

  /* status-update listener (delivered/read yansıt) */
  useEffect(() => {
    if (!socket) return;
    const handler = ({
      messageId,
      messageIds,
      conversationId,
      action,
      by,
      at,
    }) => {
      const ids = messageId ? [messageId] : messageIds || [];
      if (!ids.length) return;
      dispatch(
        applyMessageAck({
          conversationId: conversationId || convId,
          messageIds: ids,
          actionType: action, // "delivered" | "read"
          by,
          at,
        })
      );

      const lastId = ids[ids.length - 1];
      if (action === "read" && by) {
        dispatch(
          updatedLastReadId({
            conversationId: activeConversation?._id,
            lastReadMessageId: lastId,
            meId: by,
          })
        );
      }
    };
    socket.on("message:status-update", handler);
    return () => socket.off("message:status-update", handler);
  }, [socket, dispatch, convId]);

  /* messages-before dönüşünde pozisyonu koru */
  useEffect(() => {
    if (!loadingOlder) return;
    const el = listRef.current;
    if (!el) return;

    const requestedBeforeId = pendingBeforeIdRef.current;
    const newFirstId = convMessages?.[0]?._id;

    if (requestedBeforeId && newFirstId && newFirstId !== requestedBeforeId) {
      const prevH = prevScrollHeightRef.current;
      const prevT = prevScrollTopRef.current;
      const newH = el.scrollHeight;
      el.scrollTop = newH - prevH + prevT;
    }
    setLoadingOlder(false);
    pendingBeforeIdRef.current = null;
    isPrependingRef.current = false;
  }, [convMessages, loadingOlder]);
  /* Scroll: hem eski mesaj yükle, hem alttaysa okundu yap + atBottom'ı Redux'a yaz */

  const updateAtBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const at = isNearBottom(el, 40);
    setIsAtBottom(at);
    wasAtBottomRef.current = at; // kritik
    if (convId) dispatch(setAtBottom({ conversationId: convId, atBottom: at }));
  }, [convId, dispatch]);

  /* Touch/wheel yardımcıları (pull to load) */
  const handleWheel = useCallback(
    (e) => {
      const el = listRef.current;
      if (!el || loadingOlder) return;
      if (el.scrollTop <= 0 && e.deltaY < 0) loadOlder();
    },
    [loadOlder, loadingOlder]
  );

  const handleTouchStart = useCallback((e) => {
    touchStartYRef.current = e.touches?.[0]?.clientY ?? 0;
    hasTriggeredPullRef.current = false;
  }, []);

  const handleTouchMove = useCallback(
    (e) => {
      const el = listRef.current;
      if (!el || loadingOlder || hasTriggeredPullRef.current) return;
      if (el.scrollTop > 0) return;

      const currentY = e.touches?.[0]?.clientY ?? 0;
      const delta = currentY - touchStartYRef.current;
      if (delta > 60) {
        hasTriggeredPullRef.current = true;
        loadOlder();
      }
    },
    [loadOlder, loadingOlder]
  );
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || loadingOlder) return;

    if (el.scrollTop <= 100) loadOlder();

    updateAtBottom();
    //  if (wasAtBottomRef.current) markAsRead();
  }, [loadOlder, loadingOlder, updateAtBottom]); //markAsRead

  //konuşma değişti
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    wasAtBottomRef.current = true;
    if (convId) {
      setIsAtBottom(true);
      dispatch(setAtBottom({ conversationId: convId, atBottom: true }));
    }
  }, [convId, dispatch]);

  const readBatchRef = useRef(new Set());
  const timerRef = useRef(null);

  const flushReadBatch = useCallback(() => {
    const set = readBatchRef.current;
    if (!set.size) return;
    const ids = Array.from(set);
    set.clear();
    timerRef.current = null;

    socket?.emit("message:read", {
      messageIds: ids,
      conversationId: convId,
      userId,
    });
    dispatch(resetUnread(convId));
  }, [socket, convId, userId, dispatch]);

  const queueRead = useCallback(
    (id) => {
      if (!id) return;
      readBatchRef.current.add(id);
      if (timerRef.current) return;
      timerRef.current = setTimeout(flushReadBatch, 200);
    },
    [flushReadBatch]
  );

  useEffect(() => {
    // oda değişince batch'i sıfırla
    readBatchRef.current.clear();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [convId]);

  /* Yeni mesaj geldiğinde: alttaysa en alta yapışık kal + Redux'a atBottom yaz + okundu gönder */
  useEffect(() => {
    //console.log("yeni mesaj geldi en alttayım.");
    const el = listRef.current;
    if (!el || convMessages.length === 0) return;
    if (isPrependingRef.current) {
      updateAtBottom(); // sadece state/ref güncelle
      return;
    }
    const last = convMessages[convMessages.length - 1];
    const iSent = String(last?.sender?._id || last?.sender) === String(userId);
    // karar: DOM öncesi hesaplanan ref + ben gönderdiysem
    const shouldStick = wasAtBottomRef.current || iSent;

    if (shouldStick) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const box = listRef.current;
          if (!box) return;
          box.scrollTop = box.scrollHeight;
          setIsAtBottom(true);
          wasAtBottomRef.current = true;
          if (convId)
            dispatch(setAtBottom({ conversationId: convId, atBottom: true }));
        });
      });
    } else {
      // alt değilse, state/ref’i güncelle
      updateAtBottom();
    }
  }, [convMessages.length, convId, dispatch, userId, updateAtBottom]);

  /* Fokus dönüşünde alttaysa okundu yap */
  // useEffect(() => {
  //   const onFocus = () => {
  //     const el = listRef.current;
  //     if (el && isNearBottom(el)) markAsRead();
  //   };
  //   window.addEventListener("focus", onFocus);
  //   return () => window.removeEventListener("focus", onFocus);
  // }, [markAsRead]);

  /* ------ Yazıyor metni ------ */
  const typingText = React.useMemo(() => {
    const ids = (activeTypers || []).filter((id) => id !== userId);
    if (ids.length === 0) return "";

    const nameOf = (uid) => {
      const m = activeConversation?.members?.find((x) => x.user?._id === uid);
      return m?.user?.username || "Birisi";
    };

    if (activeConversation?.type === "private") return "Yazıyor…";

    const names = ids.map(nameOf).slice(0, 2);
    const more = ids.length - names.length;
    return (
      names.join(", ") + (more > 0 ? ` ve ${more} kişi ` : " ") + "yazıyor…"
    );
  }, [activeTypers]);

  /* ------ Mesaj içinde medya render ------ */
  const renderMessageMedia = (m) => {
    const file = fileS?.[convId]?.[m._id];
    const mediaUrl = file?.media_url;

    if (!mediaUrl) return null;

    const mediaType = classifyType({
      msgType: m.type,
      mime: m.mimetype,
      url: mediaUrl,
    });

    const stickIfBottom = () => {
      if (wasAtBottomRef.current) {
        endRef.current?.scrollIntoView({ block: "end" });
      }
    };

    if (mediaType === "image") {
      return (
        <span
          style={{ cursor: "zoom-in" }}
          onClick={() => openLightboxForMedia(mediaUrl)}
        >
          <img
            src={mediaUrl}
            alt="media"
            className="message__media"
            onLoad={stickIfBottom}
          />
        </span>
      );
    }

    if (mediaType === "video") {
      return (
        <button
          type="button"
          className="message__video-thumb"
          onClick={() => openLightboxForMedia(mediaUrl)}
          aria-label="Videoyu büyüt"
        >
          <video
            className="message__video-thumb-img"
            src={mediaUrl}
            muted
            preload="metadata"
            playsInline
            onLoadedMetadata={stickIfBottom}
          />
          <span className="message__video-play">▶︎</span>
        </button>
      );
    }

    if (mediaType === "audio") {
      return (
        <div className="message__media--audio">
          <audio controls src={mediaUrl} style={{ width: "100%" }} />
        </div>
      );
    }

    // diğer dosya tipleri
    const name = m.file_name || filenameFromUrl(mediaUrl);
    return (
      <div className="message__file">
        <div className="message__file-info">
          <div className="message__file-icon">📎</div>
          <div className="message__file-texts">
            <div className="message__file-name">{name}</div>
            {m.size && (
              <div className="message__file-size">
                {(m.size / 1024).toFixed(1)} KB
              </div>
            )}
          </div>
        </div>
        <div className="message__file-actions">
          <a
            className="btn btn--open"
            href={mediaUrl}
            target="_blank"
            rel="noreferrer"
          >
            Aç
          </a>
          <a className="btn btn--download" href={mediaUrl} download>
            İndir
          </a>
        </div>
      </div>
    );
  };

  const galleryItems = React.useMemo(() => {
    if (!convId) return [];

    return (convMessages || [])
      .map((m) => {
        if (m.type === "text" || !m._id) return null;

        // fileS store’dan messageId ile media_url al
        const file = fileS?.[convId]?.[m._id];
        if (!file?.media_url) return null;

        const mediaType = classifyType({
          msgType: m.type,
          mime: m.mimetype,
          url: file.media_url,
        });

        if (mediaType === "image" || mediaType === "video") {
          return {
            src: file.media_url,
            type: mediaType,
            alt: "media",
            caption: m.text || "",
          };
        }

        return null;
      })
      .filter(Boolean);
  }, [convId, convMessages, fileS]);

  const openLightboxForMedia = (mediaUrl) => {
    const idx = galleryItems.findIndex((it) => it.src === mediaUrl);
    if (idx >= 0) {
      setLightboxIndex(idx);
      setLightboxOpen(true);
    }
  };
  const closeLightbox = () => setLightboxOpen(false);
  const prevLightbox = () =>
    setLightboxIndex(
      (i) => (i - 1 + galleryItems.length) % galleryItems.length
    );
  const nextLightbox = () =>
    setLightboxIndex((i) => (i + 1) % galleryItems.length);

  // unread sayısı (aktif sohbet için)
  const unread = useSelector(
    (s) =>
      (s.conversations?.list || []).find(
        (c) => String(c._id) === String(activeConversation?._id)
      )?.unread || 0
  );

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setTimeout(() => {
      wasAtBottomRef.current = true;
      setIsAtBottom(true);
      if (convId)
        dispatch(setAtBottom({ conversationId: convId, atBottom: true }));
      //markAsRead();
    }, 200);
  }, [convId, dispatch]); //markAsRead

  useEffect(() => setProfileOpen(false), [activeConversation?._id]);

  const unreadDividerIndex = React.useMemo(() => {
    if (fetchingNew) return null;

    const unseen = collectUnseen(convMessages, userId);
    if (!unseen.length) return null;
    const firstUnseenIndex = convMessages.findIndex((m) => m._id === unseen[0]);
    return firstUnseenIndex >= 0 ? firstUnseenIndex : null;
  }, [activeConversation?._id, fetchingNew]);

  const headerAvatarUrl = React.useMemo(
    () => getHeaderAvatarKey(activeConversation, userId),
    [activeConversation, userId]
  );

  //Search
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }
    const matches = convMessages
      .map((msg, idx) => {
        if (!msg.text) return null;
        const text = msg.text.toLowerCase();
        if (text.includes(searchQuery.toLowerCase())) {
          return idx;
        }
        return null;
      })
      .filter((v) => v !== null);
    setSearchResults(matches);
    setCurrentSearchIndex(0);
  }, [searchQuery]);

  const handleSearch = (q) => {
    setSearchQuery(q);
  };

  const goNext = () => {
    if (searchResults.length === 0) return;
    setCurrentSearchIndex((i) => (i + 1) % searchResults.length);
  };
  const goPrev = () => {
    if (searchResults.length === 0) return;
    setCurrentSearchIndex(
      (i) => (i - 1 + searchResults.length) % searchResults.length
    );
  };

  // Scroll to the currently selected search result
  useEffect(() => {
    if (
      searchResults.length > 0 &&
      currentSearchIndex >= 0 &&
      currentSearchIndex < searchResults.length
    ) {
      const msgIdx = searchResults[currentSearchIndex];
      // Her mesajın DOM elemanını ref ile etiketlemek gerekiyor
      const el = listRef.current;
      if (!el) return;
      // DOM içinde ilgili mesajın elementini bul; örneğin ref atarak:
      const msgElement = el.querySelector(`[data-msg-index="${msgIdx}"]`);
      if (msgElement) {
        // mesaj öğesini görünür yap
        msgElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentSearchIndex, searchResults]);

  useEffect(() => {
    setSearchQuery(null);
    setSearchResults([]);
    setCurrentSearchIndex(0);
  }, [activeConversation?._id]);

  const resendMessage = useCallback(
    (msg) => {
      if (!socket) return;
      socket.emit(
        "send-message",
        {
          conversationId: msg.conversation,
          sender: msg.sender,
          type: msg.type,
          text: msg.text,
          media_key: msg.media_key,
          mimetype: msg.mimetype,
          size: msg.size,
          clientTempId: msg.clientId,
        },
        (ack) => {
          if (!ack || ack.success === false) {
            dispatch(
              applyMessageAck({
                conversationId: msg.conversation,
                messageId: msg._id,
                status: "failed",
              })
            );
            setSending(false);
            return;
          }
          dispatch(
            replaceTempMessage({
              conversationId: ack.message.conversation,
              tempId: msg._id,
              message: ack.message,
            })
          );
          if (ack.message.type !== "text") {
            const files = [ack.message].reduce((acc, item) => {
              if (!item?._id) return acc;
              acc[item._id] = {
                media_url: item.media_url,
                media_url_expiresAt: item.media_url_expiresAt,
              };
              return acc;
            }, {});

            dispatch(
              upsertFiles({
                conversationId: ack.message.conversation,
                files: files,
              })
            );
          }
          setSending(false);
        }
      );
    },
    [socket]
  );

  useEffect(() => {
    if (!socket) return;
    console.log(outboxRef);
    const onConnect = () => {
      outboxRef.current.forEach((m) => resendMessage(m));
    };

    socket.on("connect", onConnect);
    // (socket.io kullanıyorsan reconnect de aynı şekilde connect tetiklenir.)
    return () => socket.off("connect", onConnect);
  }, [socket, resendMessage]);

  return (
    <div className={`chat__panel ${activeConversation ? "is-visible" : ""}`}>
      {activeConversation && (
        <>
          <ChatHeader
            name={
              activeConversation?.type === "private"
                ? activeConversation?.members[0].user._id === userId
                  ? activeConversation?.members[1].user.username
                  : activeConversation?.members[0].user.username
                : activeConversation?.name
            }
            onOpenProfile={() => setProfileOpen(true)}
            activeConversation={activeConversation}
            avatar={headerAvatarUrl || "/images/default-avatar.jpg"}
            userId={userId}
            setActiveConversation={setActiveConversation}
            setactiveConversationId={setactiveConversationId}
            socket={socket}
            user={user}
            setOutgoingCall={setOutgoingCall}
            showNotification
            onSearch={handleSearch}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchIndex={currentSearchIndex}
            searchCount={searchResults.length}
            onSearchNext={goNext}
            onSearchPrev={goPrev}
          />
          {isProfileOpen && (
            <ProfileDrawer
              onClose={() => setProfileOpen(false)}
              conversation={activeConversation}
              meId={userId}
              mediaThumbs={galleryItems
                .filter((i) => i.type === "image" || i.type === "video")
                .slice(0, 9)}
              allMedia={galleryItems} // [{src,type,alt}]
              onOpenLightbox={(start) => {
                // PANEL KAPANMADAN GLOBAL LB
                setLightboxIndex(start);
                setLightboxOpen(true);
              }}
              onBlock={() => console.log("Engelle")}
              onReport={() => console.log("Şikayet et")}
              onDeleteChat={() => console.log("Sohbeti sil")}
              avatar={headerAvatarUrl || "/images/default-avatar.jpg"}
              socket={socket}
            />
          )}
        </>
      )}
      <div
        className={`chat__messages ${!hasMoreOlder ? "no-more" : ""}`}
        aria-busy={loadingOlder ? "true" : "false"}
        ref={listRef}
        onScroll={handleScroll}
        onWheel={canLoadOlder ? handleWheel : undefined}
        onTouchStart={canLoadOlder ? handleTouchStart : undefined}
        onTouchMove={canLoadOlder ? handleTouchMove : undefined}
        style={{
          overflowY: "auto",
          position: "relative",
          background:
            background?.startsWith("http") ||
            background?.startsWith("/backgrounds")
              ? `url(${background}) center/cover`
              : background || "#1C1C1C",
        }}
      >
        {activeConversation && (
          <>
            {!isOnline ? (
              <div
                className="older-chip older-chip--disabled"
                aria-disabled="true"
              >
                Çevrimdışı — eski mesajlar yüklenemiyor
              </div>
            ) : hasMoreOlder ? (
              <div className="older-chip btn-dark" onClick={loadOlder}>
                Daha eski mesajları göster
              </div>
            ) : (
              <div className="older-chip older-chip--end">
                Tüm geçmiş yüklendi
              </div>
            )}
            {loadingOlder && (
              <div
                className="chat__loading-overlay"
                onWheel={(e) => e.preventDefault()}
                onTouchMove={(e) => e.preventDefault()}
                onScroll={(e) => e.preventDefault()}
                aria-hidden="true"
              >
                <div className="chat__spinner" />
                <div className="chat__loading-text">Mesajlar yükleniyor…</div>
              </div>
            )}
          </>
        )}
        {convMessages.map((msg, index) => {
          const isMe = (msg?.sender?._id || msg?.sender) === userId;
          const isMatch = searchResults.includes(index);
          const isCurrentMatch =
            isMatch && searchResults[currentSearchIndex] === index;
          let isAvatar;
          let isName;
          if (convMessages[index + 1]?.sender !== msg.sender) {
            isName = true;
          }
          if (beforeMessage !== msg.sender) {
            beforeMessage = msg.sender;
            isAvatar = true;
          }
          return (
            <VisibleMessage
              key={msg._id || `i-${index}`}
              msg={msg}
              index={index}
              isMe={isMe}
              onVisible={queueRead} // ✅ görünür olunca batch'e ekle
              renderMessageMedia={renderMessageMedia}
              computeStatus={(m) =>
                computeEffectiveStatus(m, activeConversation, userId)
              }
              isCurrentMatch={isCurrentMatch} // arama highlight'ını senin state'inden geçirebilirsin
              conversation={activeConversation}
              isAvatar={isAvatar}
              isName={isName}
            />
          );
        })}

        <div ref={endRef} />
        {!isAtBottom && unread > 0 && (
          <div className="chat__scrollToBottom">
            <button onClick={scrollToBottom}>{unread} yeni mesaj ↓</button>
          </div>
        )}
        {file && (
          <div className="file-preview whatsapp-preview">
            {filePreviewUrl && file.type.startsWith("image/") && (
              <div className="thumb-container">
                <img
                  src={filePreviewUrl}
                  alt="preview"
                  className="thumb-image"
                />
              </div>
            )}

            {filePreviewUrl && file.type.startsWith("video/") && (
              <div className="thumb-container">
                <video
                  src={filePreviewUrl}
                  className="thumb-video"
                  muted
                  controls
                />
              </div>
            )}

            {!file.type.startsWith("image/") &&
              !file.type.startsWith("video/") && (
                <div className="thumb-container doc-thumb">
                  <div className="doc-icon">📄</div>
                  <div className="doc-info">
                    <span className="doc-name">{file.name}</span>
                  </div>
                </div>
              )}

            <button className="preview-close-btn" onClick={() => setFile(null)}>
              ×
            </button>
          </div>
        )}
      </div>
      <ChatInput
        onOptimisticMessage={(tempMsg) => {
          dispatch(
            addOptimisticMessage({
              conversationId: tempMsg.conversation,
              message: tempMsg,
            })
          );
        }}
        onAckReplace={(tempId, serverMsg) => {
          dispatch(
            replaceTempMessage({
              conversationId: serverMsg.conversation,
              tempId,
              message: serverMsg,
            })
          );
          if (serverMsg.type !== "text") {
            const files = [serverMsg].reduce((acc, item) => {
              if (!item?._id) return acc;
              acc[item._id] = {
                media_url: item.media_url,
                media_url_expiresAt: item.media_url_expiresAt,
              };
              return acc;
            }, {});

            dispatch(
              upsertFiles({
                conversationId: serverMsg.conversation,
                files: files,
              })
            );
          }
        }}
        onAckStatus={(conversationId, tempId, status) => {
          dispatch(
            applyMessageAck({
              conversationId: conversationId,
              messageId: tempId,
              status,
            })
          );
        }}
        addoutboxRef={(msg) => {
          console.log("sıraya eklendi.");
          outboxRef.current.set(msg._id, msg);
        }}
        isOnline={isOnline}
        socket={socket}
        conversationId={activeConversation?._id}
        conversation={activeConversation}
        userId={userId}
        file={file}
        setFile={setFile}
        filePreviewUrl={filePreviewUrl}
        setFilePreviewUrl={setFilePreviewUrl}
        activeConversation={activeConversation}
        setActiveConversation={setActiveConversation}
        setactiveConversationId={setactiveConversationId}
      />
      {isLightboxOpen && galleryItems.length > 0 && (
        <MediaLightbox
          items={galleryItems}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevLightbox}
          onNext={nextLightbox}
        />
      )}
      {typingText && (
        <div className="typing-indicator">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
          <span className="txt">{typingText}</span>
        </div>
      )}
    </div>
  );
};

export default ChatPanel;
