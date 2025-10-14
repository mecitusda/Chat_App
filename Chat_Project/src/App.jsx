// App.jsx
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { RouterProvider, createBrowserRouter } from "react-router";
import { store, persistor } from "./store";
import { UserContextProvider } from "./contextAPI/UserContext.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import MainLayout from "./Layouts/MainLayout.jsx";
import Chat from "./pages/chat.jsx";
import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import { ProtectedRoute, AuthRoute } from "./routes/AppRouter.jsx";
import Home from "./pages/Home.jsx";
import CallPage from "./pages/CallPage.jsx";
import "./css/main.css";
import RootLayout from "./Layouts/RootLayout.jsx";
const routes = createBrowserRouter([
  {
    element: <RootLayout />, // 🟢 Context sağlayan root
    children: [
      { path: "/", element: <Home /> },
      {
        element: <AuthRoute />,
        children: [
          { path: "login", element: <Login /> },
          { path: "register", element: <Register /> },
          { path: "verify-email", element: <VerifyEmail /> },
          { path: "change-password", element: <ChangePassword /> },
        ],
      },
      {
        element: <MainLayout />,
        children: [
          {
            element: <ProtectedRoute />,
            children: [
              { path: "chat", element: <Chat /> },
              { path: "call/:callId", element: <CallPage /> },
            ],
          },
        ],
      },
    ],
  },
]);

function App() {
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
