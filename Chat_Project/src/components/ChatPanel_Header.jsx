import React, { useMemo } from "react";
import { useSelector } from "react-redux";
import { selectPresence } from "../slices/presenceSlice";

function formatLastSeen(ts) {
  if (!ts) return "Çevrimdışı";
  const d = new Date(ts);
  return `son görülme ${d.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

const ChatPanel_Header = ({
  activeConversation,
  userId,
  name,
  avatar,
  onOpenProfile,
}) => {
  // --- PRIVATE: karşı tarafın id'si
  const peerId =
    activeConversation?.type === "private"
      ? (activeConversation.members?.[0]?.user?._id === userId
          ? activeConversation.members?.[1]?.user?._id
          : activeConversation.members?.[0]?.user?._id) || null
      : null;

  // Tek bir kullanıcının presence'ı lazım olduğunda hedef selector'ı kullan
  const peerPresence = useSelector((s) =>
    peerId ? selectPresence(s, peerId) : null
  );

  // GROUP için tüm üyelerin presence bilgilerini state’ten ham olarak çek
  // (tek selector, stabil referans; hesaplamayı useMemo ile yapacağız)
  const presencesByUser = useSelector((s) => s.presences?.byUser || {});
  const groupOnlineNames = useMemo(() => {
    if (activeConversation?.type !== "group") return [];
    const members = activeConversation?.members || [];
    return members
      .filter((m) => String(m?.user?._id) !== String(userId)) // kendini listeleme (isteğe bağlı)
      .filter((m) => presencesByUser?.[m.user._id]?.online)
      .map((m) => m.user?.username || "Bilinmeyen");
  }, [activeConversation, userId, presencesByUser]);
  //console.log(groupOnlineNames);
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

  return (
    <div className="chat__header">
      <img src={avatar} alt={name} className="chat__header-avatar" />
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
      <div className="chat__header-options">
        <button className="chat__header-option fa-solid fa-ellipsis-vertical"></button>
        <button className="chat__header-option fa-solid fa-magnifying-glass"></button>
      </div>
    </div>
  );
};

export default ChatPanel_Header;
