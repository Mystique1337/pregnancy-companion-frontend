"use client";

export default function AdminNav({ active }: { active?: string }) {
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }
  const link = (href: string, label: string, key: string) => (
    <a href={href} style={active === key ? { color: "var(--pink)" } : undefined}>
      {label}
    </a>
  );
  return (
    <div className="app-bar">
      <div className="app-bar-inner">
        <a className="logo" href="/admin">
          <div className="logo-dot" />
          Bumply <span style={{ color: "var(--ink-muted)", fontSize: 13, marginLeft: 4 }}>Admin</span>
        </a>
        <div className="app-nav">
          {link("/admin", "Overview", "overview")}
          {link("/admin/insights", "Insights", "insights")}
          {link("/admin/users", "Users", "users")}
          {link("/admin/whatsapp", "WhatsApp", "whatsapp")}
          {link("/admin/notifications", "Notifications", "notifications")}
          {link("/admin/clinicians", "Clinicians", "clinicians")}
          {link("/admin/settings", "Settings", "settings")}
          <a href="/" target="_blank">View site ↗</a>
          <button className="btn-ghost" onClick={logout} style={{ textTransform: "uppercase", fontSize: 12 }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
