import { useState } from "react";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import styles from "./SimplePage.module.css";

// Pagina tecnica (/debug/sentry, non linkata nel sito) per simulare un errore
// e verificare che arrivi su Sentry. Due casi:
// 1. errore in un gestore di evento: non lo ferma React, lo cattura l'handler
//    globale di Sentry (window.onerror);
// 2. errore durante il render: lo intercetta l'ErrorBoundary, che mostra la
//    pagina di errore e lo invia a Sentry.
function Exploding() {
  throw new Error("Sentry test error: render error from /debug/sentry");
}

export default function DebugPage() {
  useDocumentTitle("Monitoring test");
  const [explode, setExplode] = useState(false);
  const [thrown, setThrown] = useState(0);

  function throwInHandler() {
    setThrown((count) => count + 1);
    // setTimeout porta l'errore fuori dal gestore di React: diventa un
    // errore non gestito vero e proprio, come un bug in produzione.
    setTimeout(() => {
      throw new Error(`Sentry test error: unhandled error from /debug/sentry (${new Date().toISOString()})`);
    });
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Monitoring test</h1>
      <p className={styles.lead}>
        Use these buttons to send a test error to the error tracker. Environment:{" "}
        <strong>{import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE}</strong>, release:{" "}
        <strong>{import.meta.env.VITE_RELEASE || "local"}</strong>.
      </p>
      <button type="button" className="button" onClick={throwInHandler}>
        Throw an unhandled error
      </button>
      <button type="button" className="button" onClick={() => setExplode(true)}>
        Break the page (render error)
      </button>
      {thrown > 0 && <p role="status" className={styles.lead}>Errors thrown: {thrown}. Check the Sentry dashboard.</p>}
      {explode && <Exploding />}
    </div>
  );
}
