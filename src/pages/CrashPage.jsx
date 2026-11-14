import styles from "./SimplePage.module.css";

// Mostrata dall'ErrorBoundary quando un componente va in errore durante il
// render: l'errore è già stato inviato a Sentry.
export default function CrashPage() {
  return (
    <main className={styles.page} style={{ margin: "0 auto", padding: "40px 16px" }}>
      <h1 className={styles.title}>Something went wrong</h1>
      <p className={styles.lead}>The error has been reported. Reload the page to try again.</p>
      <a href="/" className="button">Go to the home page</a>
    </main>
  );
}
