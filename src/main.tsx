import "./index.css";
import { StrictMode, lazy, Suspense } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.tsx";
import { AppProvider } from "./providers/app.tsx";
import { AuthProvider } from "./providers/auth.tsx";
const AuthCallback = lazy(() => import("./components/AuthCallback.tsx"));
const GoogleDriveCallback = lazy(() => import("./components/GoogleDriveCallback.tsx"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy.tsx"));
const TermsAndServices = lazy(() => import("./pages/TermsAndServices.tsx"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <AuthProvider>
          <Routes>
            <Route
              path="/auth/callback"
              element={
                <Suspense fallback={null}>
                  <AuthCallback />
                </Suspense>
              }
            />
            <Route
              path="/auth/google-drive/callback"
              element={
                <Suspense fallback={null}>
                  <GoogleDriveCallback />
                </Suspense>
              }
            />
            <Route
              path="/privacy-policy"
              element={
                <Suspense fallback={null}>
                  <PrivacyPolicy />
                </Suspense>
              }
            />
            <Route
              path="/Terms-and-Services"
              element={
                <Suspense fallback={null}>
                  <TermsAndServices />
                </Suspense>
              }
            />
            <Route path="*" element={<App />} />
          </Routes>
        </AuthProvider>
      </AppProvider>
    </BrowserRouter>
    <SpeedInsights />
  </StrictMode>
);
