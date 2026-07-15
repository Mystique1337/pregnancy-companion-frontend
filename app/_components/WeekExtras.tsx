"use client";
import { useEffect, useRef, useState } from "react";

// Shown while Bumply generates the week's personal notes in the background.
// Polls for readiness; nudges generation if the background job didn't land;
// reloads when ready. Gives up after ~75s with a Retry (it previously spun
// forever, invisibly, if generation kept failing).
export default function WeekExtras() {
  const [elapsed, setElapsed] = useState(0);
  const [stalled, setStalled] = useState(false);
  const [attempt, setAttempt] = useState(0); // bump to restart polling
  const forcedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    let secs = 0;
    setStalled(false);
    const timer = setInterval(() => {
      secs += 1;
      setElapsed(secs);
    }, 1000);

    async function loop() {
      while (alive) {
        try {
          const r = await fetch("/api/generate", { cache: "no-store" });
          const d = await r.json();
          if (d.ready) {
            window.location.reload();
            return;
          }
        } catch {
          /* retry */
        }
        // If the background job hasn't produced anything after ~12s, kick it ourselves.
        if (!forcedRef.current && secs >= 12) {
          forcedRef.current = true;
          fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
        }
        // Still nothing after 75s → stop hammering and show a Retry.
        if (secs >= 75) {
          if (alive) setStalled(true);
          return;
        }
        await new Promise((res) => setTimeout(res, 2500));
      }
    }
    loop();
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [attempt]);

  function retry() {
    forcedRef.current = false;
    fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
    setElapsed(0);
    setAttempt((a) => a + 1);
  }

  if (stalled) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "36px 28px" }}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>🌸</div>
        <h3 className="feat-title">This week&apos;s notes are taking longer than usual</h3>
        <p className="muted" style={{ marginBottom: 16 }}>
          Everything else still works — your baby facts above are ready. You can try again now or check back in a bit.
        </p>
        <button className="btn-pink" onClick={retry}>Try again</button>
      </div>
    );
  }

  return (
    <div className="card" style={{ textAlign: "center", padding: "36px 28px" }}>
      <div style={{ width: 40, height: 40, border: "3px solid var(--lav-pale)", borderTopColor: "var(--pink)", borderRadius: "50%", margin: "0 auto 16px", animation: "spin .9s linear infinite" }} />
      <h3 className="feat-title">Bumply is writing your week…</h3>
      <p className="muted">
        Your personal meal plan, partner notes and affirmation are on their way{elapsed > 8 ? " — almost there" : ""}. 🌸
      </p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
