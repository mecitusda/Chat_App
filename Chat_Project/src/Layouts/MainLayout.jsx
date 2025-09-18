import React, { useState } from "react";
import Header from "../components/Header";
import { Outlet } from "react-router";
import Footer from "../components/Footer";
import { resetConversation } from "../slices/conversationSlice.js";
import { resetFile } from "../slices/fileSlice.js";
import { resetMessages } from "../slices/messageSlice.js";
import { useDispatch, useSelector } from "react-redux";
// import { ThemeContext } from "../contexts/ThemeContext";
const MainLayout = ({}) => {
  const SOCKET_URL = import.meta.env.VITE_BACKEND_SOCKET_URL;
  const dispatch = useDispatch();
  //dispatch(resetConversation());
  //dispatch(resetMessages());
  //dispatch(resetFile());
  //   const { theme } = useContext(ThemeContext);
  //   const color = theme === "dark" ? "bg-dark text-white" : "bg-light text-dark";
  const [activeConversation, setActiveConversation] = useState(null);
  const [resetEnabled, setResetEnabled] = useState(true);

  const handleClick = () => {
    if (resetEnabled) {
      dispatch(resetConversation());
      dispatch(resetMessages());
      dispatch(resetFile());
    }
  };

  // console.log(
  //   "maindeki chat: ",
  //   useSelector((s) => s.conversations.list || [])
  // );
  return (
    <>
      {/* <Header /> */}
      <main>
        <Outlet
          context={{
            activeConversation,
            setActiveConversation,
            SOCKET_URL,
            setResetEnabled,
            handleClick,
            resetEnabled,
          }}
        />
      </main>
      {/* <Footer /> */}
    </>
  );
};

export default MainLayout;
