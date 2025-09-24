import { upsertFiles, removeFiles } from "../slices/fileSlice";
import { groupBy } from "../helpers/groupBy";

/**
 * - Her konuşmanın altında (conversationId = conv._id) avatar kayıtlarını tutar.
 * - Kullanıcı avatarı değişirse: eski media_key'i SİL + yenisini EKLE.
 * - Grup avatarı değişirse: eski conversation-avatar'ı SİL + yenisini EKLE.
 * - Aynı kullanıcıyı aynı konuşmada birden fazla kez eklemez (per-conv uniq).
 */
export function upsertProfileAvatars(list, selfId, dispatch, getState) {
  return;
  if (!Array.isArray(list) || list.length === 0) return;

  const candidates = [];          // eklenecek yeni kayıtlar (upsert)
  const removalsByConv = {};      // conversationId -> string[] (silinmesi gereken media_key'ler)

  for (const conv of list) {
    const convId = conv?._id;
    if (!convId) continue;

    const existing = getState()?.files?.byKey?.[convId] || [];
    const seenUserIds = new Set();

    // ---- 1) GROUP AVATAR (conversation-avatar) ----
    if (conv.type === "group" && conv.avatar) {
      const newKey = conv.avatar; // media_key
      const prev = existing.find((f) => f.type === "conversation-avatar");
      if (!prev) {
        // hiç yoksa direkt ekle
        candidates.push({
          conversationId: convId,
          file: {
            media_key: newKey,
            type: "conversation-avatar",
            ownerConvId: convId,
          },
        });
      } else if (prev.media_key !== newKey) {
        // farklıysa eskisini sil, yenisini ekle
        (removalsByConv[convId] ||= []).push(prev.media_key);
        candidates.push({
          conversationId: convId,
          file: {
            media_key: newKey,
            type: "conversation-avatar",
            ownerConvId: convId,
          },
        });
      }
    }

    // ---- 2) MEMBER AVATARLARI (type: "avatar") ----
    for (const m of conv?.members || []) {
      const u = m?.user ?? m;
      if (!u || !u._id) continue;

      // aynı kullanıcıyı bu konuşmada yalnızca 1 kez işle
      if (seenUserIds.has(u._id)) continue;
      seenUserIds.add(u._id);

      const newKey = u.avatar; // media_key (yoksa atla)
      if (!newKey) continue;

      // Bu konuşmada bu kullanıcı için var olan kayıt
      const prev = existing.find(
        (f) => f.type === "avatar" && f.ownerUserId === u._id
      );

      if (!prev) {
        // ilk kez ekle
        candidates.push({
          conversationId: convId,
          file: {
            media_key: newKey,
            type: "avatar",
            ownerUserId: u._id,
            sourceConvId: convId,
          },
        });
      } else if (prev.media_key !== newKey) {
        // avatar değişmiş -> eskiyi sil, yeniyi ekle
        (removalsByConv[convId] ||= []).push(prev.media_key);
        candidates.push({
          conversationId: convId,
          file: {
            media_key: newKey,
            type: "avatar",
            ownerUserId: u._id,
            sourceConvId: convId,
          },
        });
      }
      // aynı key ise hiçbir şey yapma (gereksiz upsert yok)
    }
  }

  // ---- 3) SİL + UPSERT (konuşma bazında minimal dispatch) ----
  // duplicate candidate'ları aynı conv içinde media_key bazında uniq'leyelim
  const groupedAdds = groupBy(candidates, (x) => x.conversationId);
  for (const [conversationId, arr] of Object.entries(groupedAdds)) {
    const files = [];
    const seenKeys = new Set();
    for (const { file } of arr) {
      if (file?.media_key && !seenKeys.has(file.media_key)) {
        files.push(file);
        seenKeys.add(file.media_key);
      }
    }

    const toRemove = removalsByConv[conversationId] || [];
    if (toRemove.length > 0) {
      dispatch(removeFiles({ conversationId, mediaKeys: toRemove }));
    }
    if (files.length > 0) {
      dispatch(upsertFiles({ conversationId, files }));
    }
  }
}
