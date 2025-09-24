// components/NotificationBanner.jsx
import React, { useEffect, useState } from "react";

export default function NotificationBanner({ show }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  return (
    <div className={`notification-banner ${visible ? "show" : ""}`}>{show}</div>
  );
}
