import useScrollAnimation from "../hooks/UseScrollAnimation";

const updates = [
  { date: "2025-09-24", version: "v1.2.0", text: "Grup sohbetleri eklendi 🎉" },
  {
    date: "2025-09-20",
    version: "v1.1.0",
    text: "Arkadaş sistemi tamamlandı 🤝",
  },
  { date: "2025-09-15", version: "v1.0.0", text: "Chat uygulaması yayında 🚀" },
];

export default function UpdatesSection() {
  const [ref, visible] = useScrollAnimation();
  return (
    <section
      className={`updates scroll-animate ${visible ? "visible" : ""}`}
      ref={ref}
      id="updates"
    >
      <h2>🛠 Güncellemeler</h2>
      <div className="console">
        {updates.map((u, i) => (
          <div key={i} className="console-line">
            <span className="console-date">[{u.date}]</span>{" "}
            <span className="console-version">{u.version}</span> - {u.text}
          </div>
        ))}
      </div>
    </section>
  );
}
