import React, { useState } from "react";
import { useUserId } from "../contextAPI/UserContext.jsx"; //Dikkat Yeni açıldığında düzelt buga girdi.

export default function UserIdGate() {
  const { userId, setUserId } = useUserId();
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");

  if (userId) return null; // zaten kayıtlıysa modal açma

  const submit = (e) => {
    e.preventDefault();
    const v = val.trim();
    if (!v) return setErr("Lütfen bir kullanıcı ID gir.");
    // basit validasyon (harf-rakam-altçizgi)
    if (!/^[A-Za-z0-9_-]{2,40}$/.test(v)) {
      return setErr("Sadece harf, rakam, _ ve - kullan. (2-40 karakter)");
    }
    setUserId(v);
  };

  return (
    <div className="uid-modal">
      <div className="uid-backdrop" />
      <form className="uid-card" onSubmit={submit}>
        <h3>Kullanıcı ID gerekli</h3>
        <p>
          Karşılıklı görünürlük için bir <b>userId</b> gir:
        </p>
        <input
          autoFocus
          type="text"
          placeholder="ör. arif_01"
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            setErr("");
          }}
        />
        {err && <div className="uid-error">{err}</div>}
        <button type="submit">Devam</button>
      </form>
    </div>
  );
}
