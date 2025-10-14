import { useState } from "react";
import useScrollAnimation from "../hooks/UseScrollAnimation";
import { GoTriangleLeft } from "react-icons/go";
import { FaQuestion } from "react-icons/fa";
const faqData = [
  {
    question: "Scriber nedir?",
    answer:
      "Scriber, modern ve sade arayüzü ile kullanıcılarına hızlı mesajlaşma deneyimi sunan bir iletişim platformudur.",
  },
  {
    question: "Uygulama ücretsiz mi?",
    answer:
      "Evet! Scriber tamamen ücretsizdir. Gelecekte premium özellikler eklenebilir ama temel mesajlaşma hep ücretsiz kalacaktır.",
  },
  {
    question: "Görüntülü konuşma özelliği var mı?",
    answer:
      "Henüz görüntülü konuşma desteklenmiyor, ancak bu özellik üzerinde çalışıyoruz ve yakında kullanıma sunulacak.",
  },
  {
    question: "Mesajlarım şifreleniyor mu?",
    answer:
      "Şu an temel düzeyde veri güvenliği sağlanıyor. Uçtan uca şifreleme özelliği yakında aktif hale gelecektir.",
  },
  {
    question: "Sorun yaşarsam nasıl destek alırım?",
    answer:
      "İletişim bölümünden bize mesaj gönderebilir veya destek@sbr.app adresine e-posta atabilirsiniz.",
  },
];

export default function Faq() {
  const [ref, visible] = useScrollAnimation();
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="faq mb-2">
      <div
        className={`faq__inner scroll-animate ${visible ? "visible" : ""}`}
        ref={ref}
        id="faq"
      >
        <h2>
          <FaQuestion color="red" /> Sıkça Sorulan Sorular
        </h2>
        <div className="faq-list">
          {faqData.map((item, i) => (
            <div
              className={`faq-item ${openIndex === i ? "open" : ""}`}
              key={i}
              onClick={() => toggle(i)}
            >
              <div className="faq-header">
                <h3 className="faq-question">{item.question}</h3>
                <span className={``}>
                  <GoTriangleLeft
                    className={`faq-icon ${openIndex === i ? "rotated" : ""}`}
                  />
                </span>
              </div>
              <div className="faq-answer">
                <p>{item.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
