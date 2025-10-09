// MainLayout.jsx
import { useState } from "react";
import { Outlet } from "react-router";
import { useDispatch } from "react-redux";
import { resetConversation } from "../slices/conversationSlice.js";
import { resetFile } from "../slices/fileSlice.js";
import { resetMessages } from "../slices/messageSlice.js";
import { resetFriends } from "../slices/friendSlice.js";
import { resetAllPagination } from "../slices/paginationSlice.js";
import NotificationBanner from "../components/NotificationBanner.jsx";
import UserIdGate from "../components/UserIdGate.jsx";

const MainLayout = () => {
  const SOCKET_URL = import.meta.env.VITE_BACKEND_SOCKET_URL;
  const dispatch = useDispatch();

  const [activeConversation, setActiveConversation] = useState(null);
  const [resetEnabled, setResetEnabled] = useState(false);
  const [banner, setBanner] = useState({ message: "", ts: 0 });
  const [activeConversationId, setactiveConversationId] = useState(null);

  const showNotification = (msg) => {
    setBanner({ message: msg, ts: Date.now() }); // ts = benzersiz anahtar
  };

  const handleClick = () => {
    if (resetEnabled) {
      dispatch(resetConversation());
      dispatch(resetMessages());
      dispatch(resetFile());
      dispatch(resetFriends());
      dispatch(resetAllPagination());
    }
  };

  return (
    <>
      <main>
        {/* Kullanıcı login kontrolü */}
        <UserIdGate
          setResetEnabled={setResetEnabled}
          handleClick={handleClick}
          setActiveConversation={setActiveConversation}
          setactiveConversationId={setactiveConversationId}
        />
        {/* Banner mesajı */}
        {banner.message && (
          <NotificationBanner key={banner.ts} show={banner.message} />
        )}

        {/* Outlet + context forwarding */}
        <Outlet
          context={{
            activeConversation,
            setActiveConversation,
            SOCKET_URL,
            setResetEnabled,
            handleClick,
            resetEnabled,
            banner,
            setBanner,
            showNotification,
            activeConversationId,
            setactiveConversationId,
          }}
        />
      </main>
    </>
  );
};

export default MainLayout;
