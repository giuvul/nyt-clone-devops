// Error tracking con Sentry.
// Il DSN arriva dalla variabile VITE_SENTRY_DSN al momento della build: in
// locale da .env, in CI dai GitHub Secrets. Senza DSN Sentry resta spento
// (sviluppo e test non inviano nulla).
import * as Sentry from "@sentry/react";

export function initMonitoring(env = import.meta.env) {
  const dsn = env.VITE_SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    // development | staging | production: gli alert si filtrano per ambiente.
    environment: env.VITE_SENTRY_ENVIRONMENT || env.MODE,
    // Commit da cui è stata costruita la build: lega ogni errore a un deploy.
    release: env.VITE_RELEASE || undefined,
    integrations: [Sentry.browserTracingIntegration()],
    // 10% delle navigazioni per le prestazioni: resta nel piano gratuito.
    tracesSampleRate: 0.1,
    // Niente IP né dati personali.
    sendDefaultPii: false,
  });
  return true;
}

export { Sentry };
