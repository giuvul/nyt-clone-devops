import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "@fontsource-variable/libre-franklin";
import "@fontsource-variable/source-serif-4/opsz.css";
import "./styles/global.css";
import { createNytApi } from "./api/nytApi.js";
import App from "./App.jsx";
import CrashPage from "./pages/CrashPage.jsx";
import { initMonitoring, Sentry } from "./monitoring/sentry.js";

// Sentry parte prima di React, così registra anche gli errori dell'avvio.
initMonitoring();

// Gli hook di React 19 inoltrano a Sentry gli errori non gestiti e quelli
// intercettati dall'ErrorBoundary.
const root = createRoot(document.getElementById("root"), {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
});

// Unico punto in cui si sceglie l'implementazione reale dell'api.
root.render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashPage />}>
      <BrowserRouter>
        <App api={createNytApi()} />
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
