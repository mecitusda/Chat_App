import React from "react";

export default function IncomingCallModal({
  incomingCall,
  onAccept,
  onReject,
}) {
  if (!incomingCall) return null;

  const { type, callType, from } = incomingCall;

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-modal">
        <h3>
          {type === "group"
            ? `📞 Grup ${
                callType === "video" ? "görüntülü" : "sesli"
              } arama başladı`
            : `📞 Kullanıcı ${from} seni ${
                callType === "video" ? "görüntülü" : "sesli"
              } arıyor`}
        </h3>
        <div className="actions">
          <button className="accept-btn" onClick={onAccept}>
            ✅ Katıl
          </button>
          {type === "private" && (
            <button className="reject-btn" onClick={onReject}>
              ❌ Reddet
            </button>
          )}
          {type === "group" && (
            <button className="reject-btn" onClick={onReject}>
              ❌ Kapat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
