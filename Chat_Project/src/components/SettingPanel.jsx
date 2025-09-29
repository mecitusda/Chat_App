import React from "react";

export default function SettingsPanel({ activePage }) {
  return (
    <div
      className={`settings-panel ${
        activePage === "profileSettings" || "friendRequests"
          ? "not-visible"
          : ""
      } `}
    >
      <div className="settings-card">
        <h1 className="settings-title">⚙️ Ayarlar</h1>
        <p>Buradan uygulama ayarlarınızı düzenleyebilirsiniz.</p>
      </div>
    </div>
  );
}
