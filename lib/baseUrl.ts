// The app's public base URL, used for webhooks + email links.
// Prefers explicit env, then whatever the host injects. Set APP_URL and this
// never has to guess: webhooks break silently if it guesses wrong.
export function publicBaseUrl(): string {
  const explicit = process.env.PUBLIC_WEBHOOK_URL || process.env.APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  // Host-provided fallbacks: Coolify sets COOLIFY_URL/COOLIFY_FQDN, Railway
  // sets RAILWAY_PUBLIC_DOMAIN (bare host, no scheme).
  const coolify = process.env.COOLIFY_URL || process.env.COOLIFY_FQDN;
  if (coolify) return coolify.replace(/\/+$/, "").replace(/^(?!https?:\/\/)/, "https://");
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN;
  return railway ? `https://${railway}` : "";
}

export function isPublicHttps(url: string): boolean {
  return /^https:\/\//.test(url) && !/localhost|127\.0\.0\.1/.test(url);
}
