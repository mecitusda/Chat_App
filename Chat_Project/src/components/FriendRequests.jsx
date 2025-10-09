import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useUser } from "../contextAPI/UserContext";
import FriendList from "./FriendList";
import { addFriend, removeRequest } from "../slices/friendSlice";

// 📦 Yeni: react-phone-input-2
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

export default function FriendRequests({ socket, showNotification }) {
  const { user } = useUser();
  const dispatch = useDispatch();
  const { requests } = useSelector((state) => state.friends);

  // PhoneInput değeri: sadece rakamlar (ülke kodu dahil, + işareti YOK)
  // Örn TR için: 905461562003
  const [phoneRaw, setPhoneRaw] = useState("");
  const [sending, setSending] = useState(false);

  // İlk yükleme → listeleri çek
  useEffect(() => {
    if (!socket || !user?._id) return;
    socket.emit("friends:requests:list", { userId: user._id });
    socket.emit("friends:list:get", { userId: user._id });
  }, [socket, user?._id]);

  const send = () => {
    // Basit doğrulama (min. 8-9 hane)
    if (!phoneRaw || phoneRaw.replace(/\D/g, "").length < 9) {
      showNotification("Lütfen geçerli bir telefon numarası girin 📱");
      return;
    }
    setSending(true);
    socket.emit(
      "friends:send-request",
      { fromUserId: user._id, phone: `+${phoneRaw}` }, // ✅ rakamlı ham değer (örn 9054...)
      (resp) => {
        setSending(false);
        showNotification(resp?.message || "Hata");
      }
    );
  };

  const accept = (fromUserId) => {
    socket.emit("friends:accept", { userId: user._id, fromUserId }, (resp) => {
      if (!resp?.success) {
        showNotification(resp?.message || "Arkadaşlık isteği kabul edilemedi.");
      } else {
        const acceptedUser = requests.find((r) => r._id === resp.friendId);
        if (acceptedUser) {
          dispatch(addFriend(acceptedUser));
          dispatch(removeRequest(resp.friendId));
          showNotification(resp?.message || "Arkadaşlık isteği kabul edildi.");
        }
      }
    });
  };

  const reject = (fromUserId) => {
    socket.emit("friends:reject", { userId: user._id, fromUserId }, (resp) => {
      if (!resp?.success) {
        showNotification(resp?.message || "Arkadaşlık isteği reddedilemedi.");
      } else {
        dispatch(removeRequest(resp.fromUserId));
        showNotification(resp?.message || "Arkadaşlık isteği reddedildi 🚫");
      }
    });
  };

  return (
    <div className="friend-requests panel">
      <h2>Arkadaşlık</h2>

      {/* 📲 İstek gönderme alanı */}
      <div className="friend-send">
        <div className="phone-input" style={{ flex: "1 1 0", minWidth: 0 }}>
          <PhoneInput
            key={sending ? "sending" : "ready"}
            country={"tr"} // 🇹🇷 varsayılan ülke
            value={phoneRaw}
            onChange={(value) => setPhoneRaw(value || "")}
            countryCodeEditable={false} // kullanıcı kodu değiştiremesin
            inputProps={{
              name: "phone",
              placeholder: "(5xx) xxx xx xx",
            }}
            inputStyle={{
              width: "100%",
              backgroundColor: "#161717",
              color: "#fff",
              border: "1px solid #333",
              borderRadius: "6px",
              fontSize: "1.5rem",
              padding: "0.8rem 1rem",
            }}
            buttonStyle={{
              backgroundColor: "#161717", // bayrak arka planı siyah
              border: "1px solid #333",
            }}
            dropdownStyle={{
              backgroundColor: "#161717",
              color: "#eaeaea",
              border: "1px solid #333",
              zIndex: 9999,
            }}
            dropdownClass="dark-dropdown"
          />
        </div>

        <button disabled={sending} onClick={send} style={{ flex: "0 0 auto" }}>
          {sending ? "Gönderiliyor..." : "İstek Gönder"}
        </button>
      </div>

      {/* Gelen istekler */}
      <div className="friend-requests__list">
        <h3>Gelen İstekler</h3>
        {requests.length === 0 ? (
          <div className="empty">Bekleyen istek yok</div>
        ) : (
          requests.map((r) => (
            <div key={r._id} className="request-item">
              <div className="left">
                <img
                  src={r?.avatar?.url || "images/default-avatar.jpg"}
                  alt=""
                  width={36}
                  height={36}
                  style={{ borderRadius: 8, objectFit: "cover" }}
                />
                <div className="meta">
                  <div className="name">{r?.username || "Kullanıcı"}</div>
                  <div className="about">{r?.about || ""}</div>
                  <div className="phone">{r?.phone || ""}</div>
                </div>
              </div>
              <div className="right">
                <button className="btn-success" onClick={() => accept(r._id)}>
                  Kabul
                </button>
                <button className="btn-danger" onClick={() => reject(r._id)}>
                  Reddet
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <FriendList
        socket={socket}
        onOpenProfile={(friend) => {
          console.log("Profil aç:", friend);
        }}
        showNotification={showNotification}
      />
    </div>
  );
}
