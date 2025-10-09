// App.jsx
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { RouterProvider, createBrowserRouter } from "react-router";
import { store, persistor } from "./store";
import { UserContextProvider } from "./contextAPI/UserContext.jsx";
import useOnPageExit from "./hooks/useOnPageExit.ts";

import MainLayout from "./Layouts/MainLayout.jsx";
import Chat from "./pages/chat.jsx";
import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import { ProtectedRoute, AuthRoute } from "./routes/AppRouter.jsx";
import Home from "./pages/Home.jsx";
import CallPage from "./pages/CallPage.jsx";

const routes = createBrowserRouter([
  // 1️⃣ Ana sayfa
  {
    path: "/",
    element: <Home />, // sadece Home, MainLayout yok
  },

  // 2️⃣ MainLayout altında çalışan sayfalar
  {
    element: <MainLayout />, // ortak layout
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          { path: "chat", element: <Chat /> },
          { path: "call/:callId", element: <CallPage /> },
        ],
      },
      {
        element: <AuthRoute />,
        children: [
          { path: "login", element: <Login /> },
          { path: "register", element: <Register /> },
          { path: "verify-email", element: <VerifyEmail /> },
        ],
      },
    ],
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
          <RouterProvider router={routes} />
        </UserContextProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
