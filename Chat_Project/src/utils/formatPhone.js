export default function formatPhone(phone) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.startsWith("90") ? digits : "90" + digits;
  const country = withCountry.slice(0, 2);
  const p1 = withCountry.slice(2, 5);
  const p2 = withCountry.slice(5, 8);
  const p3 = withCountry.slice(8, 10);
  const p4 = withCountry.slice(10, 12);
  return `+${country} ${p1} ${p2} ${p3}${p4 ? " " + p4 : ""}`;
}