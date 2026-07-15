"use client";
// Offline-first SOS: the danger-sign checker + red-flag list + ANC schedule, all
// computed CLIENT-SIDE with no network or login. The service worker caches this
// page so it works with no signal — the "midwife in her pocket" for a ₦45k phone.
import { useEffect, useState } from "react";
import TriageFlow from "../_components/TriageFlow";
import { ANC_SCHEDULE } from "@/lib/anc";

const RED_FLAGS = [
  "Heavy bleeding from your vagina",
  "Baby not moving, or moving much less than usual",
  "Fits / convulsions",
  "Severe headache with blurred vision",
  "Fever with chills",
  "Your water breaks before 37 weeks",
  "Severe or constant tummy pain",
  "Swelling of your face and hands with a headache",
];

export default function SosPage() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    set();
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => { window.removeEventListener("online", set); window.removeEventListener("offline", set); };
  }, []);

  return (
    <div className="app-shell" style={{ maxWidth: 640 }}>
      <p className="s-label" style={{ color: "#C0392B" }}>Always available {online ? "" : "· offline"}</p>
      <h1 className="s-title" style={{ marginBottom: 6 }}>Am I okay?</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        A quick check that works even with no network. If something feels seriously wrong, don&apos;t wait — go to the nearest hospital now.
      </p>

      <div className="card" style={{ background: "var(--pink-pale)", border: "1px solid var(--pink)", marginBottom: 24 }}>
        <p className="s-label" style={{ marginBottom: 8 }}>🚨 Go to hospital NOW if you have any of these</p>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 14, color: "var(--ink-mid)" }}>
          {RED_FLAGS.map((f) => <li key={f}>{f}</li>)}
        </ul>
      </div>

      <p className="s-label">Check a symptom</p>
      <div style={{ marginTop: 8, marginBottom: 28 }}>
        <TriageFlow />
      </div>

      <p className="s-label">Your antenatal (ANC) visits</p>
      <div className="card" style={{ marginTop: 8 }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {ANC_SCHEDULE.map((a) => (
              <tr key={a.week} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "8px 8px 8px 0", fontWeight: 700, color: "var(--pink)", whiteSpace: "nowrap", verticalAlign: "top" }}>Wk {a.week}</td>
                <td style={{ padding: "8px 0" }}><strong>{a.title}</strong><br /><span className="muted">{a.detail}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 18 }}>This is guidance, not a diagnosis. Trust your body — when in doubt, go to your clinic.</p>
    </div>
  );
}
