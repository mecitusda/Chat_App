import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import PlusMenu from "./PlusMenu";

/**
 * props:
 * - socket
 * - conversationId
 * - userId
 * - isOnline
 * - onOptimisticMessage(tempMsg)
 * - onAckReplace(tempId, serverMsg)
 * - onAckStatus(tempId, status)
 */

export default function ChatInput({
  socket,
  conversationId,
  userId,
  isOnline,
  onOptimisticMessage,
  onAckReplace,
  onAckStatus,
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef(null);

  // --- TYPING HEARTBEAT ---
  const typingRef = useRef(false);
  const lastKeyAtRef = useRef(0);
  const lastSentAtRef = useRef(0);
  const hbTimerRef = useRef(null);
  const stopTimerRef = useRef(null);

  const TYPING_IDLE_MS = 1200;
  const TYPING_HEARTBEAT_MS = 3000;
  const HB_TICK_MS = 800;

  const startTyping = () => {
    if (!socket || !isOnline || !conversationId || !userId) return;
    if (!typingRef.current) {
      typingRef.current = true;
      socket.emit("typing", { conversationId, userId, isTyping: true });
      lastSentAtRef.current = Date.now();
    }
  };

  const heartbeatTyping = () => {
    if (!socket || !isOnline || !conversationId || !userId) return;
    if (!typingRef.current) return;
    const now = Date.now();
    if (now - lastSentAtRef.current >= TYPING_HEARTBEAT_MS) {
      socket.emit("typing", { conversationId, userId, isTyping: true });
      lastSentAtRef.current = now;
    }
  };

  const stopTyping = () => {
    if (!socket || !conversationId || !userId) return;
    if (!typingRef.current) return;
    typingRef.current = false;
    socket.emit("typing", { conversationId, userId, isTyping: false });
  };

  const notifyTyping = () => {
    startTyping();
    lastKeyAtRef.current = Date.now();
    clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      if (
        typingRef.current &&
        Date.now() - lastKeyAtRef.current >= TYPING_IDLE_MS
      ) {
        stopTyping();
      }
    }, TYPING_IDLE_MS);
  };

  useEffect(() => {
    hbTimerRef.current = setInterval(heartbeatTyping, HB_TICK_MS);
    return () => clearInterval(hbTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, conversationId, userId, isOnline]);

  // ---- Dosya seçimi / presign + upload ----
  const handlePlusSelect = (type) => {
    if (type === "media" || type === "document" || type === "camera") {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const makeTempId = () => "tmp_" + Math.random().toString(36).slice(2, 10);

  async function presignAndUpload({ file, conversationId }) {
    const { data } = await axios.get(
      `${import.meta.env.VITE_BACKEND_URL}/api/file/presigned-url/message`,
      { params: { conversationId, fileType: file.type } }
    );
    const { uploadURL, mediaKey } = data || {};
    if (!uploadURL || !mediaKey)
      throw new Error("Presigned URL veya mediaKey gelmedi.");

    await axios.put(uploadURL, file, {
      headers: { "Content-Type": file.type },
    });
    return { mediaKey, mime: file.type, size: file.size };
  }

  async function handleSend() {
    if (!isOnline || !conversationId || !userId) return;
    if (!text.trim() && !file) return;

    setSending(true);
    const tempId = makeTempId();

    try {
      let media = null;
      if (file) media = await presignAndUpload({ file, conversationId });

      // optimistic — artık receipts yok, dizi alanları kullanıyoruz
      const nowISO = new Date().toISOString();
      const optimistic = {
        _id: tempId,
        conversation: conversationId,
        sender: userId,
        // server text/mime'ye bakıp "image|video|file|text"e çeviriyor, o yüzden burada MIME göndermeye devam
        type: media ? media.mime : "text",
        text: text.trim() || null,
        media_key: media?.mediaKey || null,
        mimetype: media?.mime || null,
        size: media?.size || null,
        // yeni model
        deliveredTo: [], // <— boş başlat
        readBy: [], // <— boş başlat
        // UI için yardımcı alanlar
        createdAt: nowISO,
        updatedAt: nowISO,
        // yalnızca optimistic akışta kullanıyoruz (ikon başlangıcı)
        status: "sending",
      };

      onOptimisticMessage?.(optimistic);

      socket.emit(
        "send-message",
        {
          conversationId,
          sender: userId,
          type: optimistic.type,
          text: optimistic.text,
          media_key: optimistic.media_key,
          mimetype: optimistic.mimetype,
          size: optimistic.size,
          clientTempId: tempId,
        },
        (ack) => {
          if (!ack || ack.success === false) {
            onAckStatus?.(tempId, "failed");
            setSending(false);
            return;
          }
          // serverMessage artık deliveredTo/readBy dizileriyle gelecek
          onAckReplace?.(tempId, ack.message);
          setSending(false);
        }
      );
    } catch (err) {
      console.error("send error:", err);
      console.error("server says:", err.response?.status, err.response?.data);
      onAckStatus?.(tempId, "failed");
      setSending(false);
    } finally {
      setText("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // yazmayı bitir
      clearTimeout(stopTimerRef.current);
      stopTyping();
    }
  }

  useEffect(() => {
    return () => {
      clearTimeout(stopTimerRef.current);
      clearInterval(hbTimerRef.current);
    };
  }, []);

  return (
    <div className="chat__input-area">
      <PlusMenu onSelect={handlePlusSelect} />

      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleFileChange}
        // accept="image/*,video/*,application/pdf"
      />

      <input
        type="text"
        placeholder={isOnline ? "Mesaj yaz..." : "Çevrimdışı"}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim()) notifyTyping();
          else stopTyping();
        }}
        onBlur={stopTyping}
        disabled={!isOnline || sending}
      />

      <button onClick={handleSend} disabled={!isOnline || sending}>
        {sending ? "Gönderiliyor..." : "Gönder"}
      </button>

      {file && (
        <div className="file-preview">
          <span>{file.name}</span>
          <button onClick={() => setFile(null)}>×</button>
        </div>
      )}
    </div>
  );
}
