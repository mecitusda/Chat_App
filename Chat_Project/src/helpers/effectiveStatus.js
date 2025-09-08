// helpers/effectiveStatus.js
export function computeEffectiveStatus(msg, conversation, myId) {
  if (!msg) return "sending";
  // 1) Temp mesajlar (ack gelmeden önce)
  const isTemp =
    typeof msg._id === "string" && msg._id.startsWith("tmp_");
  if (isTemp) return "sending";

  // 2) Yeni model: deliveredTo / readBy
  const deliveredTo = Array.isArray(msg.deliveredTo) ? msg.deliveredTo : [];
  const readBy = Array.isArray(msg.readBy) ? msg.readBy : [];
  // Karşı taraf(lar): kendi id'mi hariç tut
  const otherMemberIds = (conversation?.members || [])
    .map(m => String(m.user?._id || m.user))
    .filter(uid => uid && uid !== String(myId));

  // Set'ler
  const deliveredSet = new Set(
    deliveredTo.map(x => String(x.user?._id || x.user))
  );
  const readSet = new Set(
    readBy.map(x => String(x.user?._id || x.user))
  );
  
  //console.log(otherMemberIds)

  // 3) Herkes okudu mu?
  if (otherMemberIds.length > 0 && otherMemberIds.every(id => readSet.has(id))) {
    return "read";
  }

  // 4) Herkese en az delivered oldu mu?
  if (
    otherMemberIds.length > 0 &&
    otherMemberIds.every(id => deliveredSet.has(id))
  ) {
    return "delivered";
  }

  // 5) En az birine ulaştıysa → "sent" ikonu (tek check)
  if (deliveredSet.size > 0 || readSet.size > 0) {
    return "sent";
  }

  // 6) ACK geldiyse ve temp değilse (yani DB id'li ise) artık "sent"
  return "sent";
}
