"use client";
import { useState } from "react";

export default function FamilyInvite({ token, firstName }: { token: string; firstName: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/family/${token}` : `/family/${token}`;
  const shareMsg = `Follow my pregnancy journey on Bumply 🌸 Here's how you can support me this week: ${link}`;

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <p className="s-label">Invite your partner / family</p>
      <p className="muted" style={{ marginBottom: 16 }}>
        Share a private, read-only link so {firstName ? `${firstName}'s` : "your"} partner or family can follow along and learn
        how to support you each week. They don&apos;t need an account, and they can&apos;t see your health data.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1, minWidth: 200, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13, fontFamily: "var(--sans)", color: "var(--ink-mid)" }} />
        <button className="btn-ghost btn-back" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
      </div>
      <a className="f-submit" href={`https://wa.me/?text=${encodeURIComponent(shareMsg)}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", maxWidth: 220, marginTop: 14, textDecoration: "none", alignItems: "center", justifyContent: "center" }}>
        Share on WhatsApp
      </a>
    </div>
  );
}
