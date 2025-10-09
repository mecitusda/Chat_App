import React, { useState } from "react";

export default function ChatBox({ onSend }) {
  const [text, setText] = useState("");

  const send = () => {
    if (text.trim()) {
      onSend(text);
      setText("");
    }
  };

  return (
    <div className="chat-box">
      <input
        type="text"
        placeholder="Mesaj yaz..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send()}
      />
      <button onClick={send}>Gönder</button>
    </div>
  );
}
