import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  setFriends,
  setRequests,
  addFriend,
  removeFriend,
  addRequest,
  removeRequest,
  autoAccept
} from "../slices/friendSlice";
import { useUser } from "../contextAPI/UserContext";
import { useOutletContext } from "react-router";

export function useFriends({socket, setProgress}) {
  const {showNotification} = useOutletContext();
  const { user } = useUser();
  const dispatch = useDispatch();
  const { requests, friends } = useSelector((state) => state.friends);
  //console.log("friends: ",friends, "requests: ",requests)
  useEffect(() => {
    if (!socket || !user?._id) return;
    setProgress(40)
    // ✅ Arkadaş listesi
    socket.on("friends:list", (payload) => {
      setProgress(100)
      if (payload.success) dispatch(setFriends(payload.friends));
    });

    // ✅ Gelen istekler
    socket.on("friends:requests:list", (payload) => {
      setProgress(80)
      if (payload.success) dispatch(setRequests(payload.requests));
    });

    // ✅ Yeni istek geldi
    socket.on("friends:request:incoming", ({ fromUser }) => {
      if (fromUser) {
      dispatch(addRequest(fromUser));
      showNotification("🔔Yeni bir arkadaş isteğiniz var.")  
      }
    });

    // ✅ İstek kabul edildi
    socket.on("friends:request:accepted", ({ user }) => {
      if (user) {
        dispatch(addFriend(user));
        showNotification(`🔔${user.username} arkadaşlık isteğinizi kabul etti.`)
      }
    });

    // ✅ İstek reddedildi
    socket.on("friends:request:rejected", ({ username }) => {
      if (username){
        showNotification(`🔔${username} arkadaşlık isteğinizi reddetti.`)
      }
      
    });

    // ✅ Karşılıklı istek → otomatik kabul
    socket.on("friends:auto-accepted", ({ user }) => {
      if (user) {    
      dispatch(autoAccept({ user }));
      showNotification(`🔔${user.username} arkadaşlık isteğinizi kabul etti.`)
      }
      
    });

    socket.on("friends:removed", ({ friendId }) => {
  if (friendId){
    const friend = friends.find(f => f._id === friendId);
    dispatch(removeFriend(friendId));
    showNotification(`🔔${friend.username} ile arkadaşlığınız sona erdi.`)
  }

});

    return () => {
      socket.off("friends:list");
      socket.off("friends:requests:list");
      socket.off("friends:request:incoming");
      socket.off("friends:request:accepted");
      socket.off("friends:request:rejected");
      socket.off("friends:auto-accepted");
      socket.off("friends:removed");
    };
  }, [socket, user?._id, dispatch]);
}
