// utils/extractProfileAvatars.ts
export function extractProfileAvatars(list: any[], selfId: string) {
  type Out = { conversationId: string; file: any };
  const out: Out[] = [];
  for (const conv of list || []) {
    const members = conv?.members || [];
    for (const m of members) {

      // API bazen {user:{...}} bazen direkt {...} gönderebiliyor:
      const u = m?.user ?? m;
      console.log("u: ",u)
      if (!u || !u._id || u._id === selfId) continue;

      const key = u.avatar; // burada avatar KEY (media_key) geliyor: "profile-images/.."
      if (!key) continue;

      out.push({
        conversationId: `__profile__${u._id}`,
        file: {
          media_key: key,
          type: "avatar",
          ownerUserId: u._id,
          sourceConvId: conv._id,
          // expiresAt=0 => ilk render’da presign istesin
          expiresAt: 0,
        },
      });
    }
  }
  return out;
}
