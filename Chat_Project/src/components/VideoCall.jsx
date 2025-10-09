// src/components/VideoCall.jsx
import React, { useEffect, useRef, useState } from "react";

function waitUntilConnected(socket, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (socket.connected) return resolve();
    const start = Date.now();
    const check = () => {
      if (socket.connected) return resolve();
      if (Date.now() - start > timeout)
        return reject("Socket connection timeout");
      setTimeout(check, 100);
    };
    check();
  });
}

export default function VideoCall({
  socket,
  callId,
  user,
  markReady,
  setParticipants,
}) {
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const [remoteStreams, setRemoteStreams] = useState([]);

  useEffect(() => {
    if (!socket || !user || !callId) return;
    let mounted = true;

    (async () => {
      try {
        await waitUntilConnected(socket);
      } catch (err) {
        console.error("Socket not ready:", err);
        return;
      }

      // ✅ Get camera/mic
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      if (!mounted) return;

      localStreamRef.current = localStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      markReady?.();

      socket.on("webrtc:peer-ready", ({ userId: peerId }) => {
        if (peerId === user._id) return;
        console.log(`⚙️ Peer ready: ${peerId}`);

        setParticipants((prev) =>
          prev.includes(peerId) ? prev : [...prev, peerId]
        );

        // Only start offer if my ID is smaller (avoid glare)
        if (String(user._id) < String(peerId)) {
          startOffer(peerId, localStream);
        }
      });

      // 📨 Handle offer
      socket.on("webrtc:offer", async ({ from, offer }) => {
        const pc = peersRef.current[from] || createPeer(from, localStream);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc:answer", { to: from, from: user._id, answer });
      });

      // 📨 Handle answer
      socket.on("webrtc:answer", async ({ from, answer }) => {
        const pc = peersRef.current[from];
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      });

      // 🧊 Handle ICE candidates
      socket.on("webrtc:candidate", async ({ from, candidate }) => {
        const pc = peersRef.current[from];
        if (pc && candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.warn("ICE error:", err);
          }
        }
      });

      // 🧹 Handle peer leaving
      socket.on("call:user-left", ({ userId }) => {
        const pc = peersRef.current[userId];
        if (pc) pc.close();
        delete peersRef.current[userId];
        setRemoteStreams((prev) => prev.filter((s) => s.userId !== userId));
      });
    })();

    return () => {
      mounted = false;
      [
        "webrtc:peer-ready",
        "webrtc:offer",
        "webrtc:answer",
        "webrtc:candidate",
        "call:user-left",
      ].forEach((ev) => socket.off(ev));
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
      if (localStreamRef.current)
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      setRemoteStreams([]);
    };
  }, [socket, callId, user, markReady]);

  // 🔧 Create peer connection
  function createPeer(peerId, localStream) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peersRef.current[peerId] = pc;

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    pc.ontrack = (e) => {
      const [remoteStream] = e.streams;
      setRemoteStreams((prev) => {
        if (prev.some((s) => s.userId === peerId)) return prev;
        return [...prev, { userId: peerId, stream: remoteStream }];
      });
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("webrtc:candidate", {
          to: peerId,
          from: user._id,
          candidate: e.candidate,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (
        ["disconnected", "failed", "closed"].includes(pc.iceConnectionState)
      ) {
        pc.close();
        delete peersRef.current[peerId];
        setRemoteStreams((prev) => prev.filter((s) => s.userId !== peerId));
      }
    };

    return pc;
  }

  // 🎬 Start offer creation
  async function startOffer(peerId, localStream) {
    if (peersRef.current[peerId]) return;
    const pc = createPeer(peerId, localStream);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc:offer", { to: peerId, from: user._id, offer });
      console.log(`📤 Sent offer to ${peerId}`);
    } catch (err) {
      console.error("Offer creation error:", err);
    }
  }

  return (
    <div className={`video-grid count-${remoteStreams.length + 1}`}>
      <div className="video-wrapper local">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          style={{ width: "100%", height: "auto" }}
        />
        <span className="label">You</span>
      </div>
      {remoteStreams.map(({ userId, stream }) => (
        <div key={userId} className="video-wrapper remote">
          <video
            autoPlay
            playsInline
            ref={(r) => {
              if (r) r.srcObject = stream;
            }}
            style={{ width: "100%", height: "auto" }}
          />
          <span className="label">User {userId}</span>
        </div>
      ))}
    </div>
  );
}
