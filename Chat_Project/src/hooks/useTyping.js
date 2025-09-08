import { useEffect, useState } from "react";

export function useTyping(socket, convId) {
  const [typers, setTypers] = useState({}); 
  // { userId: timestamp }

  useEffect(() => {
    if (!socket) return;

    const handler = ({ conversationId, userId, isTyping }) => {
      if (conversationId !== convId) return;

      setTypers(prev => {
        const copy = { ...prev };
        if (isTyping) {
          copy[userId] = Date.now();
        } else {
          delete copy[userId];
        }
        return copy;
      });
    };

    socket.on("typing-update", handler);
    return () => socket.off("typing-update", handler);
  }, [socket, convId]);

  // aktif “yazıyor” kullanıcıları döndür
  const activeTypers = Object.keys(typers);

  return activeTypers;
}
