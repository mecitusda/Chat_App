import React from "react";
import { FiWifiOff } from "react-icons/fi";

function formatSimpleTime(isoDateString) {
  if (isoDateString === "") {
    return "";
  }
  const now = new Date();
  const date = new Date(isoDateString);

  const isToday = now.toDateString() === date.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = yesterday.toDateString() === date.toDateString();

  if (isToday) {
    return `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  } else if (isYesterday) {
    return `Dün`;
  } else {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }
}

// ✅ Mesaj türünü anlamlı kısa bir metne çevir
function formatMessagePreview(lastMessage) {
  if (!lastMessage) return "";

  const { type, message } = lastMessage;

  switch (type) {
    case "text":
      return message?.text || "";
    case "image":
      return "🖼️ Görsel";
    case "video":
      return "🎥 Video";
    case "audio":
      return "🎵 Ses Kaydı";
    case "file":
    case "document":
      return "📎 Belge";
    case "sticker":
      return "💬 Sticker";
    case "gif":
      return "🎞️ GIF";
    default:
      return "Henüz mesaj gönderilmedi.";
  }
}

const ChatList = ({ conversations, userId, setActiveConversation, status }) => {
  //console.log(conversations);

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
        <div className="search-bar">
          <i className="fa-solid fa-magnifying-glass bar-icon"></i>
          <input
            type="text"
            placeholder="Search or start new chat"
            className="bar-input"
            name="search"
          />
        </div>

        <div className="filters">
          <button className="btn-dark active">Tümü</button>
          <button className="btn-dark">Okunmamış</button>
          <button className="btn-dark">Favoriler</button>
          <button className="btn-dark">Gruplar</button>
        </div>

        <ul className="chat__items">
          {conversations.map((conversation, index) => {
            const lastMsg = conversation.last_message;
            return (
              <li
                className="chat__item"
                key={index}
                onClick={() => setActiveConversation(conversation)}
              >
                <img
                  src={
                    conversation.type === "private"
                      ? conversation.members[0].user._id === userId
                        ? conversation.members[1].user.avatar
                          ? conversation.members[1].user.avatar
                          : "https://media.newyorker.com/photos/59095bb86552fa0be682d9d0/master/w_2560%2Cc_limit/Monkey-Selfie.jpg"
                        : conversation.members[0].user.avatar
                        ? conversation.members[0].user.avatar
                        : "https://media.newyorker.com/photos/59095bb86552fa0be682d9d0/master/w_2560%2Cc_limit/Monkey-Selfie.jpg"
                      : conversation.avatar
                      ? conversation.avatar
                      : "https://monkeyforestubud.com/wp-content/uploads/2023/08/monkeys-banner-hd.jpg?x17733"
                  }
                  alt="User"
                  className="chat__avatar"
                />

                <div className="chat__info">
                  <h3 className="chat__name">
                    {conversation.type === "private"
                      ? conversation.members[0].user._id === userId
                        ? conversation.members[1].user.username
                        : conversation.members[0].user.username
                      : conversation.name}
                  </h3>
                  <p className="chat__message">
                    {formatMessagePreview(lastMsg)}
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
          })}
        </ul>
      </div>
    </div>
  );
};

export default ChatList;
