import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useUser } from "../contextAPI/UserContext";
import { useFriends } from "../hooks/useFriends";
import FriendList from "./friendList";
import { addFriend, removeRequest } from "../slices/friendSlice";

export default function FriendRequests({ socket, showNotification }) {
  const { user } = useUser();
  const dispatch = useDispatch();
  const { requests, friends } = useSelector((state) => state.friends);
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);

  // İlk yükleme → listeyi çek
  useEffect(() => {
    if (!socket || !user?._id) return;
    socket.emit("friends:requests:list", { userId: user._id });
    socket.emit("friends:list:get", { userId: user._id });
  }, [socket, user?._id]);

  const send = () => {
    if (!phone.trim()) return;
    setSending(true);
    socket.emit(
      "friends:send-request",
      { fromUserId: user._id, phone: phone.trim() },
      (resp) => {
        setSending(false);
        setPhone("");
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
          // ✅ Arkadaş listesine ekle
          dispatch(addFriend(acceptedUser));

          // ✅ Request listesinden çıkar
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
        // ✅ Request listesinden çıkar
        dispatch(removeRequest(resp.fromUserId));

        showNotification(resp?.message || "Arkadaşlık isteği reddedildi 🚫");
      }
    });
  };

  return (
    <div className="friend-requests panel">
      <h2>Arkadaşlık</h2>

      {/* İstek gönder */}
      <div className="friend-send">
        <input
          type="tel"
          placeholder="Telefon numarası"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <button disabled={sending} onClick={send}>
          {sending ? "Gönderiliyor..." : "İstek Gönder"}
        </button>
      </div>

      {/* Gelen İstekler */}
      <div className="friend-requests__list">
        <h3>Gelen İstekler</h3>
        {requests.length === 0 ? (
          <div className="empty">Bekleyen istek yok</div>
        ) : (
          requests.map((r) => (
            <div key={r._id} className="request-item">
              <div className="left">
                <img
                  src={
                    r?.avatar?.url || "https://avatar.iran.liara.run/public/48"
                  }
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
          // burada modal açabilirsin veya başka sayfaya yönlendirebilirsin
          console.log("Profil aç:", friend);
        }}
        showNotification={showNotification}
      />
    </div>
  );
}
