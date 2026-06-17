"use client";
import { useState } from "react";

export default function EmergencyContactForm({ name: n0, phone: p0 }: { name: string | null; phone: string | null }) {
  const [name, setName] = useState(n0 || "");
  const [phone, setPhone] = useState(p0 || "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true); setSaved(false);
    await fetch("/api/emergency", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone }) });
    setBusy(false); setSaved(true);
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <p className="s-label">Emergency contact</p>
      <p className="muted" style={{ marginBottom: 16 }}>
        Who should we help you reach in an emergency? In Emergency Mode you can alert them with one tap, including your location.
      </p>
      <div className="fg">
        <label>Their name</label>
        <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} placeholder="e.g. Emeka (husband)" />
      </div>
      <div className="fg">
        <label>Their phone (with country code)</label>
        <input value={phone} onChange={(e) => { setPhone(e.target.value); setSaved(false); }} placeholder="e.g. +234 803 000 0000" inputMode="tel" />
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
        <button className="f-submit" style={{ maxWidth: 160 }} onClick={save} disabled={busy}>{busy ? "Saving…" : "Save contact"}</button>
        {saved && <span style={{ color: "var(--sage)", fontSize: 13 }}>Saved ✓</span>}
      </div>
    </div>
  );
}
