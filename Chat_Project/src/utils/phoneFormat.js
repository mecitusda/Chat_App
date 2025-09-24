// utils/phoneFormat.js
// 10 haneli ulusal numarayı (xxxxxxxxxx) "(xxx) xxx xx xx" olarak gösterir.
// State'te sadece digits tut; input.value'da formatlı göster.
export function formatPhone10(digits) {
  const d = (digits || "").replace(/\D/g, "").slice(0, 10);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 8);
  const p4 = d.slice(8, 10);

  if (d.length <= 3) return p1 ? `(${p1}` : "";
  if (d.length <= 6) return `(${p1}) ${p2}`;
  if (d.length <= 8) return `(${p1}) ${p2} ${p3}`;
  return `(${p1}) ${p2} ${p3} ${p4}`;
}
