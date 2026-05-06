// hooks/useConversationSocket.js
import { useEffect } from "react";
import { addOrUpdateConversations, setUnread, updateConversationAvatars } from "../slices/conversationSlice";
import { selectAtBottom } from "../slices/uiSlice";
import { store } from "../store";


export function useConversationSocket(
  socket,
  dispatch,
  activeConvRef,
  userId,
  playNotificationSound,
  showNotification
) {
  useEffect(() => {
    if (!socket) return;

    const handleChatlistUpdate = (r) => {
      const currentActive = activeConvRef.current;
      const convId = r.data._id;
      const isActiveConv = String(convId) === String(currentActive?._id);
      const panelAtBottom = isActiveConv
        ? selectAtBottom(store.getState(), currentActive?._id)
        : false;
      const isTabVisible = document.visibilityState === "visible";
      const isFromOther = r.data?.last_message?.sender?._id !== userId;
      const myUnread = r.data?.members.find((m) => m.user._id === userId);

      dispatch(addOrUpdateConversations([r.data]));

      if (
        !r.data?.last_message?._id ||
        (isFromOther &&
          (!isActiveConv || !panelAtBottom || !isTabVisible) &&
          r.data.last_message?.message?._id !== undefined)
      ) {
        dispatch(setUnread({ conversationId: convId, by: myUnread.unread }));
      }

      if (isFromOther) {
        socket.emit("message:delivered", {
          messageId: r?.data?.last_message?.message?._id,
          conversationId: r?.data?._id,
          userId,
        });
      }

      if (r.message === "send-message") {
        playNotificationSound();
      }

      if (r.message === "group-created") {
        showNotification(
          `🔔${r.data.createdBy.username} sizi "${r.data.name}" grubuna ekledi.`
        );
      }
    };

    const handleUpdatedAvatars = ({ updates }) => {
      dispatch(updateConversationAvatars(updates));
    };

    socket.on("chatList:update", handleChatlistUpdate);
    socket.on("conversation-avatars-updated", handleUpdatedAvatars);

    return () => {
      socket.off("chatList:update", handleChatlistUpdate);
      socket.off("conversation-avatars-updated", handleUpdatedAvatars);
    };
  }, [socket, dispatch, userId, activeConvRef, playNotificationSound, showNotification]);
}


