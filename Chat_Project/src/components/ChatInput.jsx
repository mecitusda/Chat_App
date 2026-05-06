import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import PlusMenu from "./PlusMenu";

import { EmojiPicker } from "./EmojiPickerComponent";
import { useOutletContext } from "react-router";
import { useUser } from "../contextAPI/UserContext";
/**
 * props:
 * - socket
 * - conversationId
 * - conversation
 * - userId
 * - isOnline
 * - onOptimisticMessage(tempMsg)
 * - onAckReplace(tempId, serverMsg)
 * - onAckStatus(tempId, status)
 * - activeConversation, setActiveConversation
 */
export default function ChatInput({
  socket,
  isOnline,
  onOptimisticMessage,
  addoutboxRef,
  onAckReplace,
  onAckStatus,
  file,
  setFile,
  setFilePreviewUrl,
}) {
  const { activeConversation, setActiveConversation } = useOutletContext();
  const { user } = useUser();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef(null);
  const [showPicker, setShowPicker] = useState(false);
  const pickerWrapperRef = useRef(null);
  // --- typing mantığı ---
  const typingRef = useRef(false);
  const lastKeyAtRef = useRef(0);
  const lastSentAtRef = useRef(0);
  const stopTimerRef = useRef(null);
  const hbTimerRef = useRef(null);

  const TYPING_IDLE_MS = 1200;
  const TYPING_HEARTBEAT_MS = 3000;

  useEffect(() => {
    function handleClickOutside(e) {
      // ref varsa ve tıklama alanı onun içindeyse = dış sayma
      if (
        pickerWrapperRef.current &&
        pickerWrapperRef.current.contains(e.target)
      )
        return;
      setShowPicker(false);
    }

    if (showPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPicker]);

  const startTyping = () => {
    if (!socket || !isOnline || !activeConversation?._id || !user?._id) return;
    if (!typingRef.current) {
      typingRef.current = true;
      socket.emit("typing", {
        conversationId: activeConversation?._id,
        userId: user?._id,
        isTyping: true,
      });
      lastSentAtRef.current = Date.now();
    }
  };

  const stopTyping = () => {
    if (!socket || !activeConversation?._id || !user?._id) return;
    if (!typingRef.current) return;
    typingRef.current = false;
    socket.emit("typing", {
      conversationId: activeConversation?._id,
      userId: user?._id,
      isTyping: false,
    });
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

  // heartbeat
  useEffect(() => {
    hbTimerRef.current = setInterval(() => {
      if (!socket || !isOnline || !activeConversation?._id || !user?._id)
        return;
      if (
        typingRef.current &&
        Date.now() - lastSentAtRef.current >= TYPING_HEARTBEAT_MS
      ) {
        socket.emit("typing", {
          conversationId: activeConversation?._id,
          userId: user?._id,
          isTyping: true,
        });
        lastSentAtRef.current = Date.now();
      }
    }, 800);

    return () => clearInterval(hbTimerRef.current);
  }, [socket, activeConversation?._id, user?._id, isOnline]);

  // dosya preview
  useEffect(() => {
    if (file) {
      const preview = URL.createObjectURL(file);
      setFilePreviewUrl(preview);
      return () => URL.revokeObjectURL(preview);
    } else {
      setFilePreviewUrl(null);
    }
  }, [file]);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handlePlusSelect = (type) => {
    if (["media", "document", "camera"].includes(type)) {
      fileInputRef.current?.click();
    }
  };

  const makeTempId = () => "tmp_" + Math.random().toString(36).slice(2, 10);

  // presign upload
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

  // gönderme
  async function handleSend() {
    if (!user?._id) return;
    if (!text.trim() && !file) return;

    setSending(true);
    const tempId = makeTempId();

    try {
      let convId = activeConversation?._id;

      // 📌 Private pending ise → önce sohbet oluştur
      if (activeConversation?.isPending) {
        const friendId = activeConversation.members.find(
          (m) => m.user._id !== user?._id
        ).user._id;

        const resp = await new Promise((resolve) => {
          socket.emit(
            "conversation:create-private",
            { userId: user?._id, friendId },
            (res) => resolve(res)
          );
        });

        if (!resp.success) {
          setSending(false);
          return alert(resp.message || "Sohbet oluşturulamadı");
        }

        setActiveConversation(resp.conversation);
        convId = resp.conversation._id;
      }

      // 📌 dosya varsa upload
      let media = null;
      if (file) {
        media = await presignAndUpload({ file, conversationId: convId });
      }
      const nowISO = new Date().toISOString();
      const optimistic = {
        _id: tempId,
        conversation: convId,
        clientId: tempId,
        sender: user?._id,
        type: media
          ? media.mime.startsWith("image/")
            ? "image"
            : media.mime.startsWith("video/")
            ? "video"
            : "file"
          : "text",
        text: text.trim() || null,
        media_key: media?.mediaKey || null,
        mimetype: media?.mime || null,
        size: media?.size || null,
        deliveredTo: [],
        readBy: [],
        createdAt: nowISO,
        updatedAt: nowISO,
        status: "sending",
      };

      onOptimisticMessage?.(optimistic);

      // 📌 servera yolla
      if (socket?.connected) {
        console.log("bağlı");
        socket.emit(
          "send-message",
          {
            conversationId: convId,
            sender: user?._id,
            type: optimistic.type,
            text: optimistic.text,
            media_key: optimistic.media_key,
            mimetype: optimistic.mimetype,
            size: optimistic.size,
            clientTempId: tempId,
          },
          (ack) => {
            if (!ack || ack.success === false) {
              onAckStatus?.(convId, tempId, "failed");
              setSending(false);
              return;
            }
            onAckReplace?.(tempId, ack.message);
            setSending(false);
          }
        );
      } else {
        addoutboxRef(optimistic);
      }
    } catch (err) {
      console.error("send error:", err);
      onAckStatus?.(activeConversation?._id, tempId, "failed");
      setSending(false);
    } finally {
      setText("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      clearTimeout(stopTimerRef.current);
      stopTyping();
    }
  }

  const handleKeyDown = (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {activeConversation && (
        <div className="chat__input-area">
          <div
            ref={pickerWrapperRef}
            style={{ position: "relative", display: "inline-block" }}
          >
            <button
              onClick={() => setShowPicker((prev) => !prev)}
              className="emoji-btn"
            >
              😊
            </button>

            {showPicker && (
              <div
                className="emoji-popup"
                style={{ position: "absolute", bottom: "40px", left: "0" }}
              >
                <EmojiPicker
                  className="h-[326px] rounded-lg border shadow-md"
                  onSelect={(emoji) => setText((prev) => prev + emoji.native)}
                />
              </div>
            )}
          </div>

          <PlusMenu onSelect={handlePlusSelect} />

          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={handleFileChange}
            accept="image/*,video/*,application/*"
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
            onKeyDown={handleKeyDown}
            onBlur={stopTyping}
          />

          <button onClick={handleSend} disabled={sending}>
            {sending ? "Gönderiliyor..." : "Gönder"}
          </button>
        </div>
      )}
    </>
  );
}
