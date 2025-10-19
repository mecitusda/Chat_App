import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  memo,
} from "react";
import { FiWifiOff } from "react-icons/fi";
import { useMediaUrl } from "../hooks/useMediaUrl";
import DropdownMenu from "./DropdownMenu";
import { useUser } from "../contextAPI/UserContext";
import { useSelector } from "react-redux";
import Avatar from "@mui/material/Avatar";
import { FiVideo, FiMic } from "react-icons/fi";
import { BsImage } from "react-icons/bs";
import { HiOutlineDocument, HiOutlineDocumentText } from "react-icons/hi2";
import { MdGifBox } from "react-icons/md";
import { PiStickerDuotone } from "react-icons/pi";
import Spinner from "./Spinner";

// ==== helpers ====
const MAX_SCAN_MSGS = 60; // içerik aramada taranacak mesaj sayısı (son N)
const norm = (s) => (s || "").toString().toLowerCase();
const trimSpaces = (s) => (s || "").toString().trim();
const EMPTY = [];
const FALLBACK_AVATAR = "/images/default-avatar.jpg";

function formatSimpleTime(iso) {
  if (!iso) return "";
  const now = new Date();
  const d = new Date(iso);
  const isToday = now.toDateString() === d.toDateString();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (isToday)
    return `${d.getHours().toString().padStart(2, "0")}:${d
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  if (y.toDateString() === d.toDateString()) return "Dün";
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}.${d.getFullYear()}`;
}
function highlight(text, q) {
  // Eğer string değilse (örneğin JSX, sayı, null vs), direkt döndür
  if (typeof text !== "string") return text;

  const t = text ?? "";
  const qq = trimSpaces(q);
  if (!qq) return t;

  const i = t.toLowerCase().indexOf(qq.toLowerCase());
  if (i === -1) return t;

  const before = t.slice(0, i);
  const match = t.slice(i, i + qq.length);
  const after = t.slice(i + qq.length);

  return (
    <>
      {before}
      <mark>{match}</mark>
      {after}
    </>
  );
}

// ====== alt bileşen: her satır ======
const ChatListItem = memo(function ChatListItem({
  conversation,
  userId,
  onSelect,
  title,
  previewWho,
  previewContent,
  query,
}) {
  const isPrivate = conversation.type === "private";
  const other =
    isPrivate &&
    (conversation.members?.[0]?.user?._id === userId
      ? conversation.members?.[1]?.user
      : conversation.members?.[0]?.user);
  const avatarUrl = isPrivate ? other?.avatar?.url : conversation.avatar?.url;
  const lastMsg = conversation.last_message;
  console.log(previewContent);
  return (
    <li className="chat__item" onClick={() => onSelect(conversation._id)}>
      <Avatar
        alt={
          isPrivate
            ? conversation.members[0].user._id === userId
              ? conversation.members[0].user.username
              : conversation.members[1].user.username
            : conversation.name
        }
        src={avatarUrl || FALLBACK_AVATAR}
        className="chat__avatar"
      />
      <div className="chat__info">
        <h3 className="chat__name">
          {query ? highlight(title, query) : title}
        </h3>
        <p className="chat__message">
          {previewWho && (
            <span className="chat__who">
              {query ? highlight(previewWho, query) : previewWho}:{" "}
            </span>
          )}
          <span className="chat__content">
            {query ? highlight(previewContent, query) : previewContent}
          </span>
        </p>
      </div>
      <div className="chat__time">
        <span>
          {formatSimpleTime(
            lastMsg?.message?.updatedAt || lastMsg?.updatedAt || ""
          )}
        </span>
        <div
          className={`chat__unread ${
            conversation.unread === 0 ? "is-hidden" : ""
          }`}
        >
          <div className="sayi">{conversation.unread}</div>
        </div>
      </div>
    </li>
  );
});
// ========= ANA LISTE =========
export default function ChatList({
  conversations = EMPTY,
  messagesByConv = {}, // <-- YENİ
  userId,
  setactiveConversationId,
  setActiveConversation,
  activeConversation,
  status,
  socket,
  showNotification,
  activeConversationId,
  spinner,
}) {
  // search state
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef(null);
  const { user } = useUser();
  const { friends } = useSelector((state) => state.friends);
  const [activeFilter, setActiveFilter] = useState("all"); // "all" | "unread" | "groups"

  // function formatMessagePreview(conversation) {
  //   if (!conversation?.last_message) return "";
  //   const type = conversation.last_message?.type;
  //   const senderId = conversation?.last_message?.message?.sender;
  //   let who = "";
  //   if (conversation.type === "group") {
  //     const mem = conversation?.members?.find((m) => m?.user?._id === senderId);
  //     if (!mem) return (who = "");
  //     who = mem?.user._id !== user?._id ? `${mem?.user.username}: ` : "Sen: ";
  //   }
  //   if (type === "text")
  //     return who, conversation?.last_message?.message?.text || "";
  //   if (type === "image") return who, "🖼️ Görsel";
  //   if (type === "video") return who, "🎥 Video";
  //   if (type === "audio") return who, "🎵 Ses Kaydı";
  //   if (type === "file" || type === "document") return who, "📎 Belge";
  //   if (type === "sticker") return who, "💬 Sticker";
  //   if (type === "gif") return who, "🎞️ GIF";
  //   return "Henüz mesaj gönderilmedi.";
  // }

  function formatMessagePreview(conversation, user) {
    if (!conversation?.last_message) return { who: "", content: "" };

    const { message, type } = conversation.last_message;
    const senderId = message?.sender;
    let who = "";

    // 👥 Grupsa, kim göndermiş belirle
    if (conversation.type === "group") {
      const mem = conversation?.members?.find((m) => m?.user?._id === senderId);
      if (!mem) return { who: "", content: "" };
      who = mem?.user._id !== user?._id ? mem?.user.username : "Sen  ";
    }

    // 🧩 Tip ikonları
    const map = {
      text: message?.text || "",
      image: (
        <>
          <BsImage />
        </>
      ),
      video: (
        <>
          <FiVideo />
        </>
      ),
      audio: (
        <>
          <FiMic />
        </>
      ),
      file: (
        <>
          <HiOutlineDocument />
        </>
      ),
      document: (
        <>
          <HiOutlineDocumentText />
        </>
      ),
      sticker: (
        <>
          <PiStickerDuotone />
        </>
      ),
      gif: (
        <>
          <MdGifBox />
        </>
      ),
    };

    // 🔧 Metin + ikon birleşimi
    let content;
    if (type === "text") {
      content = message?.text || "";
    } else {
      const iconPart = map[type] || "Mesaj";
      const textPart = message?.text ? `  ${message.text}` : "";
      content = (
        <>
          {iconPart}
          {textPart}
        </>
      );
    }

    return { who, content };
  }

  useEffect(() => {
    if (!socket || !conversations?.length || !user?._id) return;
    const now = Date.now();
    const expiredConvAvatars = [];
    conversations.forEach((conv) => {
      if (conv.type === "group") {
        // Grup → sadece conversation avatarını kontrol et
        if (
          conv.avatar?.url &&
          (!conv.avatar.url_expiresAt ||
            new Date(conv.avatar.url_expiresAt) <= now)
        ) {
          expiredConvAvatars.push({
            conversationId: conv._id,
            type: "conversation",
          });
        }
      } else if (conv.type === "private") {
        // Private → karşı tarafın avatarını kontrol et
        const otherMember = conv.members.find(
          (m) => String(m.user._id) !== String(user._id)
        );
        if (
          otherMember?.user?.avatar?.url &&
          (!otherMember.user.avatar.url_expiresAt ||
            new Date(otherMember.user.avatar.url_expiresAt) <= now)
        ) {
          expiredConvAvatars.push({
            userId: otherMember.user._id,
            conversationId: conv._id,
            type: "user",
          });
        }
      }
    });
    if (expiredConvAvatars.length > 0) {
      console.log("süresi dolanlar: ", expiredConvAvatars);
      socket.emit("refresh-conversation-avatars", expiredConvAvatars);
    }
  }, [socket, conversations, user?._id]);
  // debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);
  // kısayollar
  useEffect(() => {
    const onKey = (e) => {
      const isMetaK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      if (isMetaK) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape") {
        if (document.activeElement === inputRef.current && query) setQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query]);
  // title helper
  const getTitle = useCallback(
    (c) => {
      if (c.type === "private") {
        const other =
          c.members?.[0]?.user?._id === userId
            ? c.members?.[1]?.user
            : c.members?.[0]?.user;
        return other?.username || "Kullanıcı";
      }
      return c.name || "Grup";
    },
    [userId]
  );

  const filteredFriends = useMemo(() => {
    if (activeFilter === "unread" || activeFilter === "groups") return;

    const q = trimSpaces(debounced).toLowerCase();
    if (!q) return [];
    // Sohbeti zaten var olan kullanıcıları bul
    const existingChatUserIds = conversations
      .filter((c) => c.type === "private")
      .map(
        (c) =>
          c.members.find((m) => String(m.user._id) !== String(userId))?.user._id
      );
    return friends
      .filter(
        (f) =>
          f._id !== userId &&
          !existingChatUserIds.includes(String(f._id)) && // ✅ zaten sohbeti olanları çıkar
          (f.username.toLowerCase().includes(q) ||
            f.phone?.toLowerCase().includes(q))
      )
      .map((f) => ({
        _id: `friend-${f._id}`,
        friend: f,
      }));
  }, [debounced, friends, conversations, userId, activeFilter]);

  // içerik araması + snippet üretimi

  // === Mesaj arama ===
  const filteredMessages = useMemo(() => {
    const q = trimSpaces(debounced).toLowerCase();
    if (!q) return [];

    const results = [];

    for (const c of conversations) {
      // 🔎 filtreye uymuyorsa geç
      if (activeFilter === "unread" && c.unread === 0) continue;
      if (activeFilter === "groups" && c.type !== "group") continue;

      const msgs = (messagesByConv[c._id] || EMPTY).slice(-MAX_SCAN_MSGS);
      for (const m of msgs) {
        if (m?.text && m?.text.toLowerCase().includes(q)) {
          results.push({ conv: c, msg: m });
        }
      }
    }

    return results;
  }, [debounced, conversations, messagesByConv, activeFilter]);

  const messageMatchedConvIds = new Set(
    filteredMessages?.map((r) => r.conv._id)
  );

  const filteredWithPreview = useMemo(() => {
    const q = trimSpaces(debounced);
    if (!q) {
      return conversations
        .filter((c) => {
          if (activeFilter === "unread") return c.unread > 0;
          if (activeFilter === "groups") return c.type === "group";
          return true;
        })
        .map((c) => {
          const { who, content } = formatMessagePreview(c, user);
          return {
            conv: c,
            title: getTitle(c),
            previewWho: who,
            previewContent: content,
          };
        });
    }

    const qn = norm(q);
    const results = [];

    for (const c of conversations) {
      const title = getTitle(c);
      const lastPreview = formatMessagePreview(c);

      const matchesFilter =
        (activeFilter === "unread" && c.unread > 0) ||
        (activeFilter === "groups" && c.type === "group") ||
        activeFilter === "all";
      if (
        matchesFilter &&
        (norm(title).includes(qn) || norm(lastPreview).includes(qn)) &&
        !messageMatchedConvIds.has(c._id) // 👈 Eğer mesajlarda bulunduysa Sohbetler’e ekleme
      ) {
        results.push({ conv: c, title, preview: lastPreview });
      }
    }
    return results;
  }, [debounced, conversations, getTitle, messageMatchedConvIds, activeFilter]);
  // === Seçim ===
  const onSelectConversation = (id) => setactiveConversationId(id);
  const onSelectFriend = (friend) => {
    setactiveConversationId(null); // daha yok
    setActiveConversation({
      _id: "_temp",
      type: "private",
      members: [
        { user: { _id: user._id, username: user.username } },
        { user: friend },
      ],
      isPending: true, // ✅ sohbet henüz DB’de yok
    });
  };
  return (
    <div className={`chat__list ${!activeConversationId ? "is-visible" : ""}`}>
      <header className="list__header">
        <h2 className="list__title">Sohbetler</h2>
        {status === "connecting" || status === "reconnecting" ? (
          <div className="socket-connecting">
            <span className="spinner" />
            <span className="text">
              {status === "connecting" && "Sunucuya bağlanıyor…"}
              {status === "reconnecting" &&
                "Bağlantı koptu, yeniden bağlanılıyor…"}
            </span>
          </div>
        ) : null}
        {status === "offline" && (
          <div className="socket-offline">
            <FiWifiOff className="offline-icon" />
            <span>Çevrimdışı</span>
          </div>
        )}
        <div className="list__buttons">
          <div className="disabled-tip">
            <button className=" list__btn fa-solid fa-comment-medical"></button>
          </div>
          <div className="list__btn">
            <DropdownMenu socket={socket} showNotification={showNotification} />
          </div>
        </div>
      </header>
      <div className="list__body">
        {/* Searchbar */}
        <div className={`search-bar ${query ? "has-value" : ""}`}>
          <i className="fa-solid fa-magnifying-glass bar-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Ara veya yeni sohbet başlat"
            className="bar-input"
            name="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="bar-clear"
              aria-label="Temizle"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          )}
          <kbd className="kbd-shortcut">⌘K</kbd>
        </div>
        {/* Filtreler placeholder */}
        <div className="filters">
          <button
            className={`btn-dark ${activeFilter === "all" ? "active" : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            Tümü
          </button>
          <button
            className={`btn-dark ${activeFilter === "unread" ? "active" : ""}`}
            onClick={() => setActiveFilter("unread")}
          >
            Okunmamış
          </button>
          <button
            className={`btn-dark ${activeFilter === "groups" ? "active" : ""}`}
            onClick={() => setActiveFilter("groups")}
          >
            Gruplar
          </button>
        </div>
        {spinner && conversations.length === 0 && <Spinner />}
        {/* === 2) Kişiler === */}
        {filteredFriends?.length > 0 && (
          <div className="search-section">
            <h4>Kişiler</h4>
            <ul className="chat__items">
              {filteredFriends.map((f) => (
                <li
                  key={f._id}
                  className="chat__item -friend"
                  onClick={() => onSelectFriend(f.friend)}
                >
                  <Avatar
                    alt={f.friend.username}
                    src={f.friend.avatar?.url || FALLBACK_AVATAR}
                    className="chat__avatar"
                  />
                  <div className="chat__info">
                    <h3 className="chat__name">
                      {highlight(f.friend.username, query)}
                    </h3>
                    <p className="chat__message">
                      {f.friend.about || "Arkadaş"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* === 1) Sohbetler === */}
        {filteredWithPreview.length > 0 && (
          <div className="search-section">
            <ul className="chat__items">
              {filteredWithPreview.map(
                ({ conv, title, previewWho, previewContent }) => (
                  <ChatListItem
                    key={conv._id}
                    conversation={conv}
                    userId={userId}
                    onSelect={onSelectConversation}
                    title={
                      conv.type === "private"
                        ? (conv.members?.[0]?.user?._id === userId
                            ? conv.members?.[1]?.user
                            : conv.members?.[0]?.user
                          )?.username
                        : conv.name
                    }
                    previewWho={previewWho}
                    previewContent={previewContent}
                    query={query}
                  />
                )
              )}
            </ul>
          </div>
        )}
        {/* === 3) Mesajlar === */}
        {filteredMessages?.length > 0 && (
          <div className="search-section">
            <h4>Mesajlar</h4>
            <ul className="chat__items">
              {filteredMessages.map(({ conv, msg }) => (
                <li
                  key={msg._id}
                  className="chat__item -message"
                  onClick={() => onSelectConversation(conv._id)}
                >
                  <div className="chat__info">
                    <h3 className="chat__name">
                      {conv.type === "private"
                        ? (conv.members?.[0]?.user?._id === userId
                            ? conv.members?.[1]?.user
                            : conv.members?.[0]?.user
                          )?.username
                        : conv.name}
                    </h3>
                    <p className="chat__message">
                      <p className="chat__message">
                        {(() => {
                          const senderId = msg.sender;
                          let who = "";

                          if (conv.type === "group") {
                            const member = conv.members?.find(
                              (m) => m?.user?._id === senderId
                            );
                            if (member) {
                              who =
                                member.user._id !== userId
                                  ? `${member.user.username}: `
                                  : "Sen: ";
                            }
                          }

                          return highlight(`${who}${msg.text}`, query);
                        })()}
                      </p>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
