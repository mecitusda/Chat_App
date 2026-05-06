import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { useUser } from "../contextAPI/UserContext";

export function useCallSocket(SOCKET_URL, callId,conversationId) {
  const { user } = useUser();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [participants, setParticipants] = useState([]);
  const [status, setStatus] = useState("connecting");
  useEffect(() => {
    if (!SOCKET_URL || !callId || !user?._id || !conversationId) return;

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      
    });
    socketRef.current = socket;

    socket.on("connect", () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));



    socket.on("call:participants", ({ participants }) => {
      console.log("🧾 Participants:", participants);
      setParticipants(participants);
      setStatus(participants.length >= 2 ? "in-call" : "waiting");
    });


    socket.on("call:user-joined", ({ userId }) => {
      console.log("👤 User joined:", userId);
      setParticipants((prev) =>
        prev.includes(userId) ? prev : [...prev, userId]
      );
    });


    socket.on("call:user-left", ({ userId }) => {
      console.log("👤 User left:", userId);
      setParticipants((prev) => prev.filter((p) => p !== userId));
    });

    socket.on("webrtc:peer-ready", ({ userId }) => {
      // You can trigger createOffer() here for this peer
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [SOCKET_URL, callId, user?._id,conversationId]);

  const leaveCall = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("leave-call", {
        userId: user._id,
        callId,
        conversationId
      });
    }
    navigate("/chat", { replace: true });
  }, [user?._id, callId, navigate,conversationId]);

  const markReady = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("webrtc:ready", {
        userId: user._id,
        callId,
      });
    }
  }, [user?._id, callId]);

  return {
    socket: socketRef.current,
    participants,
    status,
    leaveCall,
    markReady,
    setParticipants
  };
}
