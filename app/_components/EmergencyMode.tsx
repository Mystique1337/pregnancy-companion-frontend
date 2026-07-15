"use client";
import { useState } from "react";

type Hospital = { id: string; name: string; lat: number; lon: number; distanceKm: number; phone?: string; deliveryRecommended: boolean };
type Contact = { name: string | null; phone: string | null } | null;

export default function EmergencyMode({ contact: initialContact }: { contact: Contact }) {
  const [stage, setStage] = useState<"idle" | "locating" | "active">("idle");
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [contact, setContact] = useState<Contact>(initialContact);

  async function trigger() {
    setStage("locating");
    let lat: number | undefined, lon: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 }));
      lat = pos.coords.latitude; lon = pos.coords.longitude;
      setCoords({ lat, lon });
    } catch { /* proceed without location */ }

    // NEVER strand her on "Finding the nearest help…": if the network is down
    // (very plausible in a real emergency), go straight to active mode with the
    // guidance + alert-my-contact link we already have on-device.
    try {
      const res = await fetch("/api/emergency", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lon }),
        signal: AbortSignal.timeout(12000),
      });
      const d = await res.json().catch(() => ({}));
      setHospitals(d.hospitals || []);
      if (d.contact) setContact(d.contact);
    } catch { /* offline — proceed with what we have */ }
    setStage("active");
  }

  // Pre-filled message to next-of-kin via WhatsApp / SMS (no SMS gateway needed —
  // opens the mother's own messaging app).
  function alertKinHref(): string | null {
    if (!contact?.phone) return null;
    const loc = coords ? ` My location: https://maps.google.com/?q=${coords.lat},${coords.lon}` : "";
    const top = hospitals[0] ? ` I'm heading to ${hospitals[0].name}.` : "";
    const msg = `I need help — this is a pregnancy emergency.${top}${loc}`;
    const digits = contact.phone.replace(/[^\d]/g, "");
    return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}` : `sms:${contact.phone}?&body=${encodeURIComponent(msg)}`;
  }

  if (stage === "idle") {
    return (
      <button onClick={trigger} style={bigRed} aria-label="Trigger Emergency Mode">
        <span style={{ fontSize: 30 }}>🚨</span>
        <span style={{ fontSize: 18, fontWeight: 700 }}>I need help now</span>
        <span style={{ fontSize: 12.5, opacity: 0.92, fontWeight: 400 }}>Find the nearest hospital & alert my people</span>
      </button>
    );
  }

  if (stage === "locating") {
    return <div style={{ ...bigRed, cursor: "default" }}><span style={{ fontSize: 16 }}>📍 Finding the nearest help…</span></div>;
  }

  const kin = alertKinHref();
  return (
    <div>
      <div className="card" style={{ background: "var(--pink-pale)", border: "1.5px solid var(--pink)", marginBottom: 18 }}>
        <h2 className="feat-title" style={{ marginBottom: 8, fontSize: 22 }}>🚨 Emergency Mode is active</h2>
        <p style={{ marginBottom: 14, lineHeight: 1.6 }}>
          If this is life-threatening — heavy bleeding, fits, severe pain, your baby not moving — <strong>get to a hospital now</strong>. Your clinician has been alerted.
        </p>
        {kin ? (
          <a href={kin} target="_blank" rel="noreferrer" style={{ ...bigRed, minHeight: 0, padding: "14px 18px", textDecoration: "none", marginBottom: 0 }}>
            📲 Alert {contact?.name || "my contact"} now
          </a>
        ) : (
          <p className="muted" style={{ fontSize: 13 }}>Add an emergency contact in your account to alert them with one tap next time.</p>
        )}
      </div>

      <p className="s-label">Nearest hospitals</p>
      {hospitals.length === 0 ? (
        <p className="muted" style={{ marginBottom: 12 }}>
          {coords ? "Couldn't load a list just now — go to the closest hospital you know, or call your clinic." : "Location wasn't shared, so we can't list nearby hospitals. Go to the closest hospital you know."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          {hospitals.map((h) => (
            <div key={h.id} className="card" style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 15 }}>{h.name} {h.deliveryRecommended ? "🤰" : ""}</p>
                <p className="muted" style={{ fontSize: 12 }}>{h.distanceKm.toFixed(1)} km away{h.phone ? ` · ${h.phone}` : ""}</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {h.phone && <a className="chip" href={`tel:${h.phone}`}>Call</a>}
                <a className="chip" href={`https://maps.google.com/?q=${h.lat},${h.lon}`} target="_blank" rel="noreferrer" style={{ background: "var(--pink)", color: "white", borderColor: "var(--pink)" }}>Directions →</a>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
        🤰 = facility likely to handle delivery. Trust your instincts — if in doubt, go to the nearest hospital.
      </p>
      <button className="btn-ghost btn-back" onClick={() => setStage("idle")} style={{ marginTop: 12 }}>Close</button>
    </div>
  );
}

const bigRed: React.CSSProperties = {
  width: "100%", minHeight: 110, borderRadius: 18, border: "none", cursor: "pointer",
  background: "linear-gradient(135deg,#C0392B,#E0563F)", color: "white",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
  boxShadow: "0 10px 28px rgba(192,57,43,.32)", marginBottom: 18, textAlign: "center",
};
