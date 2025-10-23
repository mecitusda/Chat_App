import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { shallowEqual, useSelector } from "react-redux";
import { makeSelectPresence } from "../slices/presenceSlice";
import { FiArrowLeft } from "react-icons/fi"; // Feather
import { useNavigate } from "react-router";
import { MdCall, MdClose } from "react-icons/md";
import { FiVideo } from "react-icons/fi";
import { FcVideoCall } from "react-icons/fc";
import { FaSearch, FaChevronUp, FaChevronDown } from "react-icons/fa";
import OnlineAvatar from "../components/OnlineAvatar";
import SearchInput from "./SearchInput";
//call onclick
// onClick={() => {
//   // Eğer aktif görüşme yoksa → başlat
//   if (!activeConversation.active_call) {
//     handleStartCall();
//     return;
//   }

//   // Eğer zaten görüşme varsa → odaya katıl
//   socket.emit(
//     "call:create-or-join",
//     {
//       conversationId: activeConversation._id,
//       userId: user._id,
//       callType: "video",
//       conversationType: activeConversation.type,
//       peers: activeConversation.members.map((m) => m.user?._id),
//     },
//     (res) => {
//       if (res.success && res.callId) {
//         navigate(`/call/${res.callId}`, {
//           state: { callerId: user._id },
//         });
//       } else {
//         showNotification("Çağrıya katılım başarısız oldu");
//       }
//     }
//   );
// }}

function formatLastSeen(ts) {
  if (!ts) return "Çevrimdışı";

  let d;
  if (typeof ts === "number") d = new Date(ts);
  else if (typeof ts === "string") d = new Date(ts);
  else if (ts instanceof Date) d = ts;
  else return "Çevrimdışı";

  if (isNaN(d.getTime())) return "Çevrimdışı";

  const now = new Date();

  const isSameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  const timeStr = d.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isSameDay) {
    return `son görülme bugün ${timeStr}`;
  } else if (isYesterday) {
    return `son görülme dün ${timeStr}`;
  } else {
    const dateStr = d.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    return `son görülme ${dateStr} ${timeStr}`;
  }
}

function getActiveParticipantsCount(conversation) {
  if (
    !conversation?.active_call ||
    !Array.isArray(conversation.active_call.participants)
  )
    return 0;

  // joined_at dolu ama left_at olmayanları say
  return conversation.active_call.participants.filter(
    (p) => p.joined_at && !p.left_at
  ).length;
}

const ChatPanel_Header = ({
  activeConversation,
  userId,
  name,
  avatar,
  onOpenProfile,
  setActiveConversation,
  setactiveConversationId,
  socket,
  user,
  setOutgoingCall,
  showNotification,
  onSearch,
  searchQuery,
  searchIndex,
  searchCount,
  onSearchNext,
  onSearchPrev,
  setSearchQuery,
}) => {
  const navigate = useNavigate();
  const [isSearching, setIsSearching] = useState(searchQuery);
  const inputRef = useRef(null);

  const handleIconClick = () => {
    console.log("nullandı.");
    setSearchQuery(null);
    setIsSearching(false);
  };

  useEffect(() => {
    if (isSearching) {
      inputRef.current?.focus();
    }
  }, [isSearching]);

  useEffect(() => {
    setIsSearching(false);
  }, [activeConversation._id]);

  const onChange = (e) => {
    onSearch?.(e.target.value);
  };

  // --- PRIVATE: karşı tarafın id'si
  const peerId =
    activeConversation?.type === "private"
      ? (activeConversation.members?.[0]?.user?._id === userId
          ? activeConversation.members?.[1]?.user?._id
          : activeConversation.members?.[0]?.user?._id) || null
      : null;

  const selectPresenceForPeer = peerId ? makeSelectPresence(peerId) : null;
  // Tek bir kullanıcının presence'ı lazım olduğunda hedef selector'ı kullan
  const peerPresence = useSelector(
    (state) => (selectPresenceForPeer ? selectPresenceForPeer(state) : null),
    shallowEqual
  );

  // GROUP için tüm üyelerin presence bilgilerini state’ten ham olarak çek
  // (tek selector, stabil referans; hesaplamayı useMemo ile yapacağız)
  const presencesByUser = useSelector((s) => s.presences?.byUser, shallowEqual);
  const groupOnlineNames = useMemo(() => {
    if (activeConversation?.type !== "group") return [];
    const members = activeConversation?.members || [];
    return members
      .filter((m) => String(m?.user?._id) !== String(userId)) // kendini listeleme (isteğe bağlı)
      .filter((m) => presencesByUser?.[m.user._id]?.online)
      .map((m) => m.user?.username || "Bilinmeyen");
  }, [activeConversation, userId, presencesByUser]);

  // Status metni:
  const statusText =
    activeConversation?.type === "private"
      ? peerPresence?.online
        ? "Çevrimiçi"
        : formatLastSeen(peerPresence?.lastSeen)
      : // group
      groupOnlineNames.length
      ? // Çok kişi varsa kısalt: ilk 2 + “+N kişi”
        groupOnlineNames.length > 2
        ? `${groupOnlineNames.slice(0, 2).join(", ")} +${
            groupOnlineNames.length - 2
          } kişi çevrimiçi`
        : `${groupOnlineNames.join(", ")} çevrimiçi`
      : "Şu an kimse çevrimiçi değil";

  const handleStartCall = () => {
    if (!socket || !user) return;
    const peerIds = (activeConversation?.members || [])
      .map((m) => m.user?._id)
      .filter(Boolean);

    socket.emit(
      "call:create-or-join",
      {
        conversationId: activeConversation._id,
        userId: user._id,
        callType: "video",
        conversationType: activeConversation.type, // "private" | "group"
        peers: peerIds,
      },
      (res) => {
        if (!res.success) {
          showNotification("Call başlatılamadı: " + res.message);
          return;
        }

        const callId = res.callId;

        if (activeConversation.type === "group") {
          // ✅ Grup → direkt odaya gir
          navigate(`/call/${res.callId}`, { state: { callerId: user._id } });
        } else {
          // ✅ Private → bekleme ekranına al
          setOutgoingCall({
            callId,
            peerId: peerIds.find((id) => id !== user._id),
            conversationId: activeConversation._id,
          });
        }
      }
    );
  };
  return (
    <div className="chat__header">
      <button
        className={`back-btn`}
        onClick={() => {
          setActiveConversation(null);
          setactiveConversationId(null);
        }}
      >
        {" "}
        <FiArrowLeft />
      </button>
      <OnlineAvatar
        src={avatar}
        alt={
          activeConversation.type === "private"
            ? activeConversation.members[0].user._id === userId
              ? activeConversation.members[0].user.username
              : activeConversation.members[1].user.username
            : activeConversation.name
        }
        isOnline={
          peerPresence
            ? peerPresence.online
            : groupOnlineNames.length > 0
            ? true
            : false
        }
        className={"chat__header-avatar"}
        onClick={onOpenProfile}
      />

      <div
        className="chat__header-info"
        onClick={onOpenProfile}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onOpenProfile?.()}
        style={{ cursor: "pointer" }}
      >
        <span className="chat__header-name">{name}</span>
        <span className="chat__header-status">{statusText}</span>
      </div>

      <div className={"chat__header-options"}>
        <SearchInput
          ref={inputRef}
          isSearching={isSearching}
          searchQuery={searchQuery}
          onChange={onChange}
          onSearchNext={onSearchNext}
          onSearchPrev={onSearchPrev}
          handleIconClick={handleIconClick}
          searchCount={searchCount}
          searchIndex={searchIndex}
        />
        <button
          className={`chat__header-option ${
            !isSearching ? "active" : "closed"
          }`}
        >
          <FaSearch
            className="search-button"
            onClick={() => {
              setIsSearching(true);
            }}
          />
        </button>

        <div className="disabled-tip" data-tip="Geliştirme aşamasında">
          <button
            className={`chat__header-option ${
              activeConversation.active_call?.participants.length > 0
                ? "active-call-btn"
                : "call-btn"
            }`}
            title={
              activeConversation.active_call
                ? "Devam eden aramaya katıl"
                : "Yeni arama başlat"
            }
          >
            {activeConversation.active_call?.participants.length ? (
              <>
                <FiVideo size={24} />
                <span className="call-badge">
                  {getActiveParticipantsCount(activeConversation)}
                </span>
              </>
            ) : (
              <MdCall size={24} color="#8696a0" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel_Header;
