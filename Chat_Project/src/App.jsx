import { useState } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import ReactDOM from "react-dom/client";
import { Provider, useDispatch } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { UserContextProvider } from "./contextAPI/UserContext.jsx";
import MainLayout from "../src/Layouts/MainLayout.jsx";
import Chat from "./pages/chat.jsx";
import { store, persistor } from "./store";
import UserIdGate from "./components/UserIdGate.jsx";
import useOnPageExit from "./hooks/useOnPageExit.ts";
const routes = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [{ index: true, element: <Chat /> }],
  },
]);

function App() {
  useOnPageExit(() => {
    const lastSeen = new Date().toISOString();
    localStorage.setItem("last_seen", lastSeen);
  });
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <UserContextProvider>
          <UserIdGate />
          <RouterProvider router={routes} />
        </UserContextProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
