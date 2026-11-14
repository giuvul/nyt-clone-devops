// Error tracking con Sentry.
// Il DSN arriva dalla variabile VITE_SENTRY_DSN al momento della build: in
// locale da .env, in CI dai GitHub Secrets. Senza DSN Sentry resta spento
// (i test e chi clona il repository senza .env non inviano nulla).
import * as Sentry from "@sentry/react";

export function initMonitoring(env = import.meta.env) {
  const dsn = env.VITE_SENTRY_DSN;
  if (!dsn) return false;

  // development | staging | production: gli alert si filtrano per ambiente.
  const environment = env.VITE_SENTRY_ENVIRONMENT || env.MODE;
  const isDevelopment = environment === "development";

  Sentry.init({
    dsn,
    environment,
    // Commit da cui è stata costruita la build: lega ogni errore a un deploy.
    release: env.VITE_RELEASE || undefined,
    integrations: [
      Sentry.browserTracingIntegration(),
      // Registrazione della sessione solo quando c'è un errore, con testi e
      // immagini mascherati: si vede cosa ha fatto l'utente prima del bug.
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    // Prestazioni: tutte le navigazioni in locale, il 10% online per restare
    // nel piano gratuito.
    tracesSampleRate: isDevelopment ? 1.0 : 0.1,
    // Le richieste al nostro proxy portano l'header di tracing.
    tracePropagationTargets: [/^\/api\//],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Niente IP né dati personali.
    sendDefaultPii: false,
  });
  return true;
}

export { Sentry };
