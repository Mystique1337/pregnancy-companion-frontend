"use client";
import { useState } from "react";
import { LANGUAGES } from "@/lib/languages";

const WEEKS = Array.from({ length: 40 }, (_, i) => i + 1);
const ETHNICITIES = [
  "Yoruba", "Igbo", "Hausa", "Fulani", "Ijaw", "Kanuri", "Tiv", "Ibibio / Efik",
  "Edo", "Nupe", "Urhobo", "Non-Nigerian", "Prefer not to say", "Other",
];

export default function RegisterForm() {
  const [form, setForm] = useState({
    full_name: "",
    partner_name: "",
    email: "",
    password: "",
    phone: "",
    due_date: "",
    current_week: "",
    first_pregnancy: "yes",
    dietary_restrictions: "",
    ethnicity: "",
    language: "en",
  });
  const [otherEth, setOtherEth] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setError("");
    if (!form.full_name || !form.email || !form.password || !form.current_week || !form.due_date) {
      setError("Please fill in your name, email, password, due date and current week.");
      return;
    }
    if (form.password.length < 8) {
      setError("Please use a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const ethnicity = form.ethnicity === "Other" ? otherEth.trim() : form.ethnicity;
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ethnicity, current_week: parseInt(form.current_week, 10), source: "website" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setDone(true);
      setTimeout(() => (window.location.href = "/dashboard"), 1200);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  }

  if (done) {
    return (
      <div className="form-card">
        <div className="f-success show">
          <div className="fs-icon">🌸</div>
          <h3 className="fs-title">Welcome to Bumply</h3>
          <p className="fs-msg">You're registered! Taking you to your dashboard… 💕</p>
        </div>
      </div>
    );
  }

  return (
    <div className="form-card">
      <h3 className="fc-head">Register for Bumply</h3>
      <p className="fc-sub">Create your account and your first weekly update is ready right away.</p>

      <div className="f-row">
        <div className="fg">
          <label>Your First Name</label>
          <input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Amara" />
        </div>
        <div className="fg">
          <label>Partner&apos;s Name</label>
          <input value={form.partner_name} onChange={(e) => set("partner_name", e.target.value)} placeholder="David" />
        </div>
      </div>
      <div className="fg">
        <label>Email Address</label>
        <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="amara@email.com" />
      </div>
      <div className="fg">
        <label>Password</label>
        <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="At least 8 characters" />
      </div>
      <div className="fg">
        <label>Phone / WhatsApp</label>
        <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+234 800 000 0000" />
      </div>
      <div className="fg">
        <label>Due Date</label>
        <input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
      </div>
      <div className="fg">
        <label>Current Week of Pregnancy</label>
        <select value={form.current_week} onChange={(e) => set("current_week", e.target.value)}>
          <option value="" disabled>
            Select your current week
          </option>
          {WEEKS.map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </select>
      </div>
      <div className="fg">
        <label>Is this your first pregnancy?</label>
        <select value={form.first_pregnancy} onChange={(e) => set("first_pregnancy", e.target.value)}>
          <option value="yes">Yes — first time 🌸</option>
          <option value="no">No — I&apos;ve done this before</option>
        </select>
      </div>
      <div className="fg">
        <label>Ethnicity (for your meal plan)</label>
        <select value={form.ethnicity} onChange={(e) => set("ethnicity", e.target.value)}>
          <option value="">Select (so we curate local meals)</option>
          {ETHNICITIES.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        {form.ethnicity === "Other" && (
          <input style={{ marginTop: 8 }} value={otherEth} onChange={(e) => setOtherEth(e.target.value)} placeholder="Type your ethnicity / cuisine" />
        )}
      </div>
      <div className="fg">
        <label>Dietary Restrictions (optional)</label>
        <input value={form.dietary_restrictions} onChange={(e) => set("dietary_restrictions", e.target.value)} placeholder="e.g. vegetarian, no nuts, lactose intolerant" />
      </div>
      <div className="fg">
        <label>Preferred Language</label>
        <select value={form.language} onChange={(e) => set("language", e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native}
            </option>
          ))}
        </select>
      </div>

      <button className="f-submit" onClick={submit} disabled={busy}>
        {busy ? "Creating your account…" : "Begin My Journey ✨"}
      </button>
      {error && <p className="f-error">{error}</p>}
      <p className="f-note">Your weekly companion, ready in seconds · Free during beta</p>
    </div>
  );
}
