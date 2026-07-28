"use client";

import { useEffect } from "react";

const STORAGE_KEY = "vibe-routes-pdf-html";

/**
 * Same-origin print host so the PDF window is not about:blank
 * (browser print footers were showing about:blank at the bottom-left).
 */
export default function PrintPage() {
  useEffect(() => {
    try {
      const html = sessionStorage.getItem(STORAGE_KEY);
      if (!html) {
        document.body.innerHTML =
          "<main style='font-family:Georgia,serif;padding:48px;color:#5c534c'>" +
          "<p>Nothing to print. Go back and tap <strong>Export PDF</strong> again.</p>" +
          "</main>";
        return;
      }
      sessionStorage.removeItem(STORAGE_KEY);
      // Replace this Next.js shell with the full print document
      document.open();
      document.write(html);
      document.close();
    } catch {
      document.body.innerHTML =
        "<main style='font-family:Georgia,serif;padding:48px;color:#5c534c'>" +
        "<p>Could not open the print view.</p>" +
        "</main>";
    }
  }, []);

  return (
    <main
      style={{
        fontFamily: "Georgia, serif",
        padding: 48,
        color: "#000000",
        minHeight: "100vh",
        background: "#ffffff",
      }}
    >
      Preparing your itinerary PDF…
    </main>
  );
}
