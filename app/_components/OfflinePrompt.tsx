"use client";
// Prompt her to install the offline pack WHILE SHE HAS NETWORK.
//
// The pack is ~100MB and only matters when signal fails, which is exactly when
// it cannot be downloaded. So the prompt belongs on the screens she opens on a
// good connection, not on the emergency screen she reaches with one bar.
//
// Hidden once installed, and hidden while offline, when the advice would be useless.
import { useEffect, useState } from "react";
import Link from "next/link";

export default function OfflinePrompt({ href = "/chat#offline" }: { href?: string }) {
  // Renders by default and hides itself once it knows better. Starting hidden
  // meant the card depended on an effect firing, which made it invisible in
  // server output and flaky to verify. Showing first is also the safer default:
  // the worst case is a mother sees an offer she has already taken.
  const [show, setShow] = useState(true);

  useEffect(() => {
    const decide = () => {
      let ready = false, dismissed = false;
      try {
        ready = localStorage.getItem("bumply_offline_ready") === "1";
        dismissed = localStorage.getItem("bumply_offline_dismissed") === "1";
      } catch { /* private mode: keep showing */ }
      setShow(!ready && !dismissed && navigator.onLine);
    };
    decide();
    addEventListener("online", decide);
    addEventListener("offline", decide);
    return () => { removeEventListener("online", decide); removeEventListener("offline", decide); };
  }, []);

  if (!show) return null;

  return (
    <div className="card" style={{ marginTop: 16, display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div aria-hidden style={{ fontSize: 22, lineHeight: 1.2 }}>📶</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 700 }}>Set up Bumply for when there is no network</p>
        <p className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
          A one-time download while you are on WiFi. After that, danger-sign checks and common
          answers work with no signal at all.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <Link href={href} className="f-submit"
            style={{ maxWidth: 180, textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            Set it up
          </Link>
          <button
            onClick={() => { try { localStorage.setItem("bumply_offline_dismissed", "1"); } catch {} setShow(false); }}
            style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
