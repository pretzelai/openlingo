import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles.css";
import { Shell } from "./components/Shell";
import { LandingPage } from "./pages/LandingPage";
import { AuthPage } from "./pages/AuthPage";
import { ChatPage } from "./pages/ChatPage";
import { UnitsPage } from "./pages/UnitsPage";
import { ReadPage } from "./pages/ReadPage";
import { WordsPage } from "./pages/WordsPage";
import { SettingsPage } from "./pages/SettingsPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/sign-in" element={<AuthPage mode="sign-in" />} />
        <Route path="/sign-up" element={<AuthPage mode="sign-up" />} />
        <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
        <Route path="/reset-password" element={<AuthPage mode="reset" />} />
        <Route element={<Shell />}>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/units" element={<UnitsPage />} />
          <Route path="/read" element={<ReadPage />} />
          <Route path="/words" element={<WordsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
