"use client";

import { useEffect } from "react";

// Only catches errors thrown by the root layout itself (Providers, fonts,
// etc.) — everything else is caught by error.tsx. Must render its own
// <html>/<body> and can't rely on globals.css, since that's part of the
// layout that just failed; inline styles keep this self-contained.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "#0d1b2e",
          color: "#ffffff",
          fontFamily: "Arial, Helvetica, sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Something went wrong</h1>
        <p style={{ maxWidth: 400, color: "#94a3b8", fontSize: "0.875rem", margin: 0 }}>
          NextReport hit an unexpected error. Please refresh the page.
        </p>
        {error.digest && (
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>
            Error reference: <span style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{error.digest}</span>
          </p>
        )}
        <button
          onClick={() => reset()}
          style={{
            background: "#f5b45a",
            color: "#0d1b2e",
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
