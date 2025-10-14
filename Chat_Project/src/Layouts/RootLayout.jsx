// src/Layouts/RootLayout.jsx
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import NotificationBanner from "../components/NotificationBanner";

export default function RootLayout() {
  const [banner, setBanner] = useState({ message: "", ts: 0 });

  const showNotification = (msg) => {
    setBanner({ message: msg, ts: Date.now() });
  };

  return (
    <>
      {banner.message && (
        <NotificationBanner key={banner.ts} show={banner.message} />
      )}

      {/* Tüm alt sayfalara context sağlanıyor */}
      <Outlet context={{ showNotification }} />
    </>
  );
}
