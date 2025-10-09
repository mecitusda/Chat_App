import React from "react";

export default function OutgoingCallModal({ call, onCancel }) {
  if (!call) return null;

  return (
    <div className="outgoing-call-overlay">
      <div className="outgoing-call-modal">
        <h3>📞 {call.peerName || "Kullanıcı"} aranıyor...</h3>
        <p className="sub-text">
          {call.callType === "video" ? "Görüntülü arama" : "Sesli arama"}
        </p>

        <div className="actions">
          <button className="cancel-btn" onClick={onCancel}>
            ❌ İptal Et
          </button>
        </div>
      </div>
    </div>
  );
}
