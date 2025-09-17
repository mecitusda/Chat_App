// import React from "react";
// import { FiWifiOff } from "react-icons/fi";
// import { useMediaUrl } from "../hooks/useMediaUrl";
// function formatSimpleTime(isoDateString) {
//   if (isoDateString === "") {
//     return "";
//   }
//   const now = new Date();
//   const date = new Date(isoDateString);

//   const isToday = now.toDateString() === date.toDateString();
//   const yesterday = new Date(now);
//   yesterday.setDate(now.getDate() - 1);
//   const isYesterday = yesterday.toDateString() === date.toDateString();

//   if (isToday) {
//     return `${date.getHours().toString().padStart(2, "0")}:${date
//       .getMinutes()
//       .toString()
//       .padStart(2, "0")}`;
//   } else if (isYesterday) {
//     return `Dün`;
//   } else {
//     const day = date.getDate().toString().padStart(2, "0");
//     const month = (date.getMonth() + 1).toString().padStart(2, "0");
//     const year = date.getFullYear();
//     return `${day}.${month}.${year}`;
//   }
// }

// // ✅ Mesaj türünü anlamlı kısa bir metne çevir
// function formatMessagePreview(conversation) {
//   if (!conversation?.last_message) return "";
//   let who = "";
//   if (conversation.type === "group") {
//     who = conversation?.members?.filter(
//       (s) => s.user._id === conversation?.last_message?.message?.sender
//     );
//     who = who[0]?.user?.username + ": ";
//   }

//   switch (conversation?.last_message?.type) {
//     case "text":
//       return who + conversation.last_message.message?.text || "";
//     case "image":
//       return "🖼️ Görsel";
//     case "video":
//       return who + "🎥 Video";
//     case "audio":
//       return who + "🎵 Ses Kaydı";
//     case "file":
//     case "document":
//       return who + "📎 Belge";
//     case "sticker":
//       return who + "💬 Sticker";
//     case "gif":
//       return who + "🎞️ GIF";
//     default:
//       return "Henüz mesaj gönderilmedi.";
//   }
// }

// const ChatList = ({
//   conversations,
//   userId,
//   setactiveConversationId,
//   status,
// }) => {
//   //console.log(conversations);

//   return (
//     <div className="chat__list">
//       <header className="list__header">
//         <h2 className="list__title">Sohbetler</h2>

//         {status === "connecting" || status === "reconnecting" ? (
//           <div className="socket-connecting">
//             <span className="spinner" />
//             <span className="text">
//               {status === "connecting" && "Sunucuya bağlanıyor…"}
//               {status === "reconnecting" &&
//                 "Bağlantı koptu, yeniden bağlanılıyor…"}
//             </span>
//           </div>
//         ) : null}

//         {status === "offline" && (
//           <div className="socket-offline">
//             <FiWifiOff className="offline-icon" />
//             <span>Çevrimdışı</span>
//           </div>
//         )}

//         <div className="list__buttons">
//           <button className=" list__btn fa-solid fa-comment-medical"></button>
//           <button className="list__btn fa-solid fa-ellipsis-vertical"></button>
//         </div>
//       </header>

//       <div className="list__body">
//         <div className="search-bar">
//           <i className="fa-solid fa-magnifying-glass bar-icon"></i>
//           <input
//             type="text"
//             placeholder="Search or start new chat"
//             className="bar-input"
//             name="search"
//           />
//         </div>

//         <div className="filters">
//           <button className="btn-dark active">Tümü</button>
//           <button className="btn-dark">Okunmamış</button>
//           <button className="btn-dark">Favoriler</button>
//           <button className="btn-dark">Gruplar</button>
//         </div>

//         <ul className="chat__items">
//           {conversations.map((conversation, index) => {
//             const lastMsg = conversation.last_message;
//             return (
//               <li
//                 className="chat__item"
//                 key={index}
//                 onClick={() => setactiveConversationId(conversation._id)}
//               >
//                 <img
//                   src={
//                     conversation.type === "private"
//                       ? conversation.members[0].user._id === userId
//                         ? conversation.members[1].user.avatar
//                           ? useMediaUrl(conversation.members[1].user.avatar)
//                           : "https://avatar.iran.liara.run/public/49"
//                         : conversation.members[0].user.avatar
//                         ? useMediaUrl(conversation.members[0].user.avatar)
//                         : "https://avatar.iran.liara.run/public/49"
//                       : conversation.avatar
//                       ? useMediaUrl(conversation.avatar)
//                       : "https://avatar.iran.liara.run/public/49"
//                   }
//                   alt="User"
//                   className="chat__avatar"
//                 />

//                 <div className="chat__info">
//                   <h3 className="chat__name">
//                     {conversation.type === "private"
//                       ? conversation.members[0].user._id === userId
//                         ? conversation.members[1].user.username
//                         : conversation.members[0].user.username
//                       : conversation.name}
//                   </h3>
//                   <p className="chat__message">
//                     {formatMessagePreview(conversation)}
//                   </p>
//                 </div>

//                 <div className="chat__time">
//                   <span>
//                     {formatSimpleTime(
//                       lastMsg?.message?.updatedAt || lastMsg?.updatedAt || ""
//                     )}
//                   </span>
//                   <div
//                     className={`chat__unread ${
//                       conversation.unread === 0 ? "is-hidden" : ""
//                     }`}
//                   >
//                     <div className="sayi">{conversation.unread}</div>
//                   </div>
//                 </div>
//               </li>
//             );
//           })}
//         </ul>
//       </div>
//     </div>
//   );
// };

// export default ChatList;

// ChatList.jsx
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

// ==== helpers ====
const MAX_SCAN_MSGS = 60; // içerik aramada taranacak mesaj sayısı (son N)
const norm = (s) => (s || "").toString().toLowerCase();
const trimSpaces = (s) => (s || "").toString().trim();
const EMPTY = [];
const FALLBACK_AVATAR = "https://avatar.iran.liara.run/public/49";

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

function formatMessagePreview(conversation) {
  if (!conversation?.last_message) return "";
  const type = conversation.last_message.type;
  const senderId = conversation?.last_message?.message?.sender;
  let who = "";
  if (conversation.type === "group") {
    const mem = conversation?.members?.find((m) => m?.user?._id === senderId);
    who = mem?.user?.username ? `${mem.user.username}: ` : "";
  }
  if (type === "text")
    return who + (conversation.last_message.message?.text || "");
  if (type === "image") return who + "🖼️ Görsel";
  if (type === "video") return who + "🎥 Video";
  if (type === "audio") return who + "🎵 Ses Kaydı";
  if (type === "file" || type === "document") return who + "📎 Belge";
  if (type === "sticker") return who + "💬 Sticker";
  if (type === "gif") return who + "🎞️ GIF";
  return "Henüz mesaj gönderilmedi.";
}

function highlight(text, q) {
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
  preview,
  query,
}) {
  const isPrivate = conversation.type === "private";
  const other =
    isPrivate &&
    (conversation.members?.[0]?.user?._id === userId
      ? conversation.members?.[1]?.user
      : conversation.members?.[0]?.user);
  const avatarKey = isPrivate ? other?.avatar : conversation.avatar;
  const avatarUrl = useMediaUrl(avatarKey);

  const lastMsg = conversation.last_message;

  return (
    <li className="chat__item" onClick={() => onSelect(conversation._id)}>
      <img
        src={avatarUrl || FALLBACK_AVATAR}
        alt="User"
        className="chat__avatar"
      />

      <div className="chat__info">
        <h3 className="chat__name">
          {query ? highlight(title, query) : title}
        </h3>
        <p className="chat__message">
          {query ? highlight(preview, query) : preview}
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
  status,
}) {
  // search state
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef(null);

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

  // içerik araması + snippet üretimi
  const filteredWithPreview = useMemo(() => {
    const q = trimSpaces(debounced);
    if (!q) {
      // query yoksa isim + son mesajı döndür
      return conversations.map((c) => ({
        conv: c,
        title: getTitle(c),
        preview: formatMessagePreview(c),
      }));
    }

    const qn = norm(q);
    const results = [];

    for (const c of conversations) {
      const title = getTitle(c);
      const lastPreview = formatMessagePreview(c);

      // grupsa üye isimlerini de indexe kat
      const memberNames =
        c.type === "group"
          ? (c.members || []).map((m) => m?.user?.username || "").join(" ")
          : "";

      // önce hızlı alanlarda ara
      const hayTitle = norm(title);
      const hayLast = norm(lastPreview);
      const hayMembers = norm(memberNames);

      let matched = false;
      let snippet = "";

      if (
        hayTitle.includes(qn) ||
        hayLast.includes(qn) ||
        (memberNames && hayMembers.includes(qn))
      ) {
        matched = true;
        // title veya last’tan snippet
        if (hayLast.includes(qn)) snippet = lastPreview;
        else snippet = title;
      } else {
        // içerikte ara (son N mesaj)
        const msgs = (messagesByConv[c._id] || EMPTY).slice(-MAX_SCAN_MSGS);
        for (let i = msgs.length - 1; i >= 0; i--) {
          const m = msgs[i];
          if (m?.type === "text" && m?.text) {
            const txt = m.text.toString();
            if (norm(txt).includes(qn)) {
              matched = true;
              // snippet: eşleşmeyi ortala
              const idx = norm(txt).indexOf(qn);
              const start = Math.max(0, idx - 24);
              const end = Math.min(txt.length, idx + q.length + 24);
              snippet =
                (start > 0 ? "…" : "") +
                txt.slice(start, end) +
                (end < txt.length ? "…" : "");
              break;
            }
          } else if (m?.type && m.type !== "text") {
            // medya tiplerini anahtar kelimeye çevir
            const mediaWord =
              m.type === "image"
                ? "görsel"
                : m.type === "video"
                ? "video"
                : m.type === "audio"
                ? "ses"
                : m.type === "file" || m.type === "document"
                ? "belge"
                : m.type;
            if (norm(mediaWord).includes(qn)) {
              matched = true;
              snippet = `(${mediaWord})`;
              break;
            }
          }
        }
      }

      if (matched) {
        results.push({
          conv: c,
          title,
          preview: snippet || lastPreview || "",
        });
      }
    }

    return results;
  }, [debounced, conversations, messagesByConv, getTitle]);

  const onSelect = useCallback(
    (id) => setactiveConversationId(id),
    [setactiveConversationId]
  );

  return (
    <div className="chat__list">
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
          <button className=" list__btn fa-solid fa-comment-medical"></button>
          <button className="list__btn fa-solid fa-ellipsis-vertical"></button>
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
          <button className="btn-dark active">Tümü</button>
          <button className="btn-dark">Okunmamış</button>
          <button className="btn-dark">Favoriler</button>
          <button className="btn-dark">Gruplar</button>
        </div>

        {/* Liste */}
        <ul className="chat__items">
          {filteredWithPreview.map(({ conv, title, preview }) => (
            <ChatListItem
              key={conv._id}
              conversation={conv}
              userId={userId}
              onSelect={onSelect}
              title={title}
              preview={preview}
              query={query}
            />
          ))}
        </ul>

        {filteredWithPreview.length === 0 && (
          <div className="chat__empty">
            {trimSpaces(query) ? "Eşleşen sonuç yok." : "Sohbet yok."}
          </div>
        )}
      </div>
    </div>
  );
}
