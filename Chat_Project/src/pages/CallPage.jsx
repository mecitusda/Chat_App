// src/pages/CallPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { MdArrowBack } from "react-icons/md";
import { useUser } from "../contextAPI/UserContext";
import { useCallSocket } from "../hooks/useCallSocket";
import VideoCall from "../components/VideoCall";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const SOCKET_URL = import.meta.env.VITE_BACKEND_SOCKET_URL;

export default function CallPage() {
  const { callId } = useParams();
  const { user } = useUser();
  const location = useLocation();
  const callerId = location.state?.callerId || null;

  const [conversationId, setConversationId] = useState(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const hasJoinedRef = useRef(false);

  // 🧠 Fetch the conversationId for the call
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await axios.get(
          `${BACKEND_URL}/api/call/conversationId/${callId}`
        );
        if (active && data.success) setConversationId(data.conversationId);
      } catch (err) {
        console.error("❌ conversationId fetch error:", err);
      }
    })();
    return () => {
      active = false;
    };
  }, [callId]);

  // 🧩 Use Socket.IO hook
  const {
    socket,
    participants,
    status,
    leaveCall,
    markReady,
    setParticipants,
  } = useCallSocket(SOCKET_URL, callId, conversationId);

  // 🟢 Join call when socket connects
  useEffect(() => {
    if (socket && socket.connected && user && !hasJoinedRef.current) {
      hasJoinedRef.current = true;
      console.log("📞 Joining call:", { user: user._id, callId });

      socket.emit("join-call", { userId: user._id, callId });
    }
  }, [socket, socket?.connected, user, callId, conversationId]);

  // 🧹 Handle page refresh or close
  useEffect(() => {
    if (!socket) return;
    const handleUnload = () => {
      if (socket.connected) {
        socket.emit("leave-call", { userId: user._id, callId, conversationId });
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [socket, user, callId]);

  return (
    <div className="call-page">
      <header className="call-header">
        <h2>📞 Room: {callId}</h2>
        <p className={`status status-${status}`}>Status: {status}</p>
        <button
          className="participants-toggle"
          onClick={() => setShowParticipants(true)}
        >
          👥 Participants ({participants.length})
        </button>
      </header>

      {showParticipants && (
        <>
          <div
            className="participants-overlay"
            onClick={() => setShowParticipants(false)}
          />
          <aside className="participants-drawer">
            <div className="drawer-header">
              <button
                className="close-btn"
                onClick={() => setShowParticipants(false)}
              >
                <MdArrowBack className="back-icon" size={20} />
              </button>
              <h3>Participants</h3>
            </div>
            <ul>
              {participants.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </aside>
        </>
      )}

      <div className="video-area">
        <VideoCall
          socket={socket}
          callId={callId}
          conversationId={conversationId}
          user={user}
          callerId={callerId}
          markReady={markReady}
          setParticipants={setParticipants}
        />
      </div>

      <button className="leave-btn" onClick={() => leaveCall()}>
        🚪 Leave Call
      </button>
    </div>
  );
}
