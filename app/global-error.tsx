"use client";

import { PALETTE, TYPOGRAPHY } from "@/lib/theme/tokens";

const p = PALETTE.light;

/** Last-resort error screen when the root layout itself fails (it must render its own html and body). */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: TYPOGRAPHY.body, background: p.canvas, color: p.textPrimary, display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <main style={{ maxWidth: 480, textAlign: "center", padding: 24 }} role="alert">
          <h1 style={{ fontSize: 28, fontWeight: 600 }}>The app could not start this page</h1>
          <p style={{ color: p.textSecondary }}>Your saved work is not affected. Try again, or restart the app.</p>
          <button onClick={reset} style={{ marginTop: 16, height: 40, padding: "0 24px", borderRadius: 9999, border: 0, background: p.primary, color: p.onPrimary, fontWeight: 500, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
