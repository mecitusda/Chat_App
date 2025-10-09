import React from "react";

export default function MessageList({ messages }) {
  return (
    <div className="message-list">
      {messages.map((msg, i) => (
        <div key={i} className={`msg ${msg.sender === "me" ? "me" : "other"}`}>
          <span>{msg.text}</span>
        </div>
      ))}
    </div>
  );
}
