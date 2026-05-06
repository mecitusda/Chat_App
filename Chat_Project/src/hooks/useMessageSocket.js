// hooks/useMessageSocket.js
import { useEffect } from "react";
import { addOrUpdateMessages, applyMessageAck } from "../slices/messageSlice";
import { upsertFiles } from "../slices/fileSlice";
import { setHasMore, setOldestMessageId } from "../slices/paginationSlice";


export function useMessageSocket(socket, dispatch, activeConvRef, userId) {
  useEffect(() => {
    if (!socket) return;

    const handleMessageList = (newData) => {
      const arr = newData?.messages || [];
      const page = newData?.pageInfo || {};
      
      const convId =
        newData.conversationId ||
        arr[0]?.conversation ||
        activeConvRef.current?._id;
      if (!convId) return;

      if (typeof page.hasMoreBefore === "boolean") {
        dispatch(
          setHasMore({ conversationId: convId, hasMore: page.hasMoreBefore })
        );
      }
      if (arr.length === 0) return;

      const direction = page.before ? "prepend" : "append";
      dispatch(
        addOrUpdateMessages({
          conversationId: convId,
          messages: arr,
          direction,
        })
      );

      const oldest = arr[0]?._id || null;
      if (oldest) {
        dispatch(
          setOldestMessageId({ conversationId: convId, messageId: oldest })
        );
      }

      const minimal = arr
        .filter((m) => m && m.type !== "text" && m.media_url)
        .reduce((acc, m) => {
          acc[m._id] = {
            media_url: m.media_url,
            media_url_expiresAt: m.media_url_expiresAt,
          };
          return acc;
        }, {});

      if (Object.keys(minimal).length > 0) {
        dispatch(upsertFiles({ conversationId: convId, files: minimal }));
      }

      // delivered işaretle
      const toDeliver = arr
        .filter((m) => String(m?.sender?._id || m?.sender) !== String(userId))
        .filter(
          (m) =>
            !(m.deliveredTo || []).some(
              (x) => String(x.user?._id || x.user) === String(userId)
            )
        )
        .map((m) => m._id);

      toDeliver.forEach((id) => {
        socket.emit("message:delivered", {
          messageId: id,
          conversationId: convId,
          userId,
        });
      });
    };

    const handlePreUrls = ({ urls, conversationId }) => {
      const TTL_MS = 10 * 60 * 1000;

      const enriched = (urls || []).reduce((acc, u) => {
        acc[u.messageId] = {
          media_url: u.media_url,
          media_url_expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
        };
        return acc;
      }, {});

      if (Object.keys(enriched).length > 0) {
        dispatch(upsertFiles({ conversationId, files: enriched }));
      }
    };

    const handleStatusUpdate = ({
      messageId,
      messageIds,
      conversationId,
      action,
      by,
      at,
    }) => {
      const conv = activeConvRef.current;
      const ids = messageId ? [messageId] : messageIds || [];
      if (ids.length === 0) return;

      dispatch(
        applyMessageAck({
          conversationId: conversationId || conv?._id,
          messageIds: ids,
          actionType: action,
          by,
          at: at || Date.now(),
        })
      );
    };

    socket.on("messageList", handleMessageList);
    socket.on("pre-urls", handlePreUrls);
    socket.on("message:status-update", handleStatusUpdate);

    return () => {
      socket.off("messageList", handleMessageList);
      socket.off("pre-urls", handlePreUrls);
      socket.off("message:status-update", handleStatusUpdate);
    };
  }, [socket, dispatch, activeConvRef, userId]);
}


