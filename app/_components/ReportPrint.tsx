"use client";

export default function ReportPrint() {
  return (
    <div className="no-print" style={{ display: "flex", gap: 10, justifyContent: "center", margin: "8px 0 24px" }}>
      <button className="btn-pink" onClick={() => window.print()}>🖨️ Print / Save as PDF</button>
      <a className="btn-ghost" href="/dashboard">Back to app</a>
    </div>
  );
}
