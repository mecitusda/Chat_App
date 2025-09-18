import React, { useEffect, useState } from "react";

const NotificationBanner = ({ show }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);

      const timer = setTimeout(() => {
        setVisible(false);
      }, 3000); // 3 saniye sonra gizle

      return () => clearTimeout(timer);
    }
  }, [show]);

  return (
    <div className={`notification-banner ${visible ? "show" : ""}`}>
      🔔 Basma demedik mi amınakoduğum.
    </div>
  );
};

export default NotificationBanner;
