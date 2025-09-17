import React, { useState } from "react";
import { useUser } from "../contextAPI/UserContext.jsx"; //Dikkat Yeni açıldığında düzelt buga girdi.

export default function UserIdGate() {
  const { user, setUser } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [err, setErr] = useState("");

  if (user) return null; // zaten kayıtlıysa modal açma

  const submit = async (e) => {
    e.preventDefault();

    const em = email.trim();
    const p = password.trim();

    if (!em || !p) {
      return setErr("Lütfen email ve şifre gir.");
    }
    // basit validasyon (harf-rakam-altçizgi)
    if (!/^[A-Za-z0-9@._-]{4,40}$/.test(em)) {
      return setErr("Geçerli bir email girin. (Harf, rakam, @, _ ve -)");
    }

    console.log("değerler: ", em, p);
    const response = await fetch(`http://127.0.0.1:5000/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: em,
        password: p,
      }),
    }).then(async (r) => await r.json());
    console.log(response);
    if (response.success) setUser(response.user);
  };

  return (
    <div className="uid-modal">
      <div className="uid-backdrop" />
      <form className="uid-card" onSubmit={submit}>
        <h3>Email</h3>
        <p>
          Karşılıklı görünürlük için bir <b>email</b> gir:
        </p>
        <input
          autoFocus
          type="text"
          placeholder="ör. arif_01"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErr("");
          }}
        />
        <p>
          Karşılıklı görünürlük için bir <b>şifre</b> gir:
        </p>
        <input
          autoFocus
          type="text"
          placeholder="ör. Kardelen123"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErr("");
          }}
        />
        {err && <div className="uid-error">{err}</div>}
        <button type="submit">Devam</button>
      </form>
    </div>
  );
}
