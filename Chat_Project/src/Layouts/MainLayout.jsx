import { resetConversation } from "../slices/conversationSlice.js";
import { resetFile } from "../slices/fileSlice.js";
import { resetMessages } from "../slices/messageSlice.js";
import { resetFriends } from "../slices/friendSlice.js";
import { resetAllPagination } from "../slices/paginationSlice.js";
// MainLayout.jsx
import { useState, useCallback, useMemo } from "react";
import { Outlet, useOutletContext } from "react-router";
import { useDispatch } from "react-redux";
import UserIdGate from "../components/UserIdGate.jsx";

const MainLayout = () => {
  const SOCKET_URL = import.meta.env.VITE_BACKEND_SOCKET_URL;
  const dispatch = useDispatch();

  const [activeConversation, setActiveConversation] = useState(null);
  const [resetEnabled, setResetEnabled] = useState(false);
  const [activeConversationId, setactiveConversationId] = useState(null);
  const { showNotification } = useOutletContext();

  // ✅ stable callback
  const handleClick = useCallback(() => {
    if (resetEnabled) {
      dispatch(resetConversation());
      dispatch(resetMessages());
      dispatch(resetFile());
      dispatch(resetFriends());
      dispatch(resetAllPagination());
    }
  }, [dispatch, resetEnabled]);

  // ✅ stable context
  const outletContext = useMemo(
    () => ({
      activeConversation,
      setActiveConversation,
      SOCKET_URL,
      setResetEnabled,
      handleClick,
      activeConversationId,
      setactiveConversationId,
      showNotification,
    }),
    [
      activeConversation,
      activeConversationId,
      SOCKET_URL,
      setResetEnabled,
      handleClick,
      showNotification,
    ]
  );

  return (
    <main>
      {/* Kullanıcı login kontrolü */}
      <UserIdGate
        setResetEnabled={setResetEnabled}
        handleClick={handleClick}
        setActiveConversation={setActiveConversation}
        setactiveConversationId={setactiveConversationId}
      />

      {/* Outlet + context forwarding */}
      <Outlet context={outletContext} />
    </main>
  );
};

export default MainLayout;
