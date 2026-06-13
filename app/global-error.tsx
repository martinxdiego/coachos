"use client";

// Catches errors thrown in the root layout itself. It replaces the whole
// document, so it cannot rely on globals.css or shared components — keep it
// fully self-contained with inline styles.
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#0f172a",
          color: "#e2e8f0",
          padding: 24
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
            Etwas ist schiefgelaufen
          </h1>
          <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 20 }}>
            Die Anwendung ist auf einen unerwarteten Fehler gestoßen. Bitte lade
            die Seite neu.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "#10b981",
              color: "#04231a",
              border: "none",
              borderRadius: 10,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer"
            }}
            type="button"
          >
            Neu laden
          </button>
        </div>
      </body>
    </html>
  );
}
