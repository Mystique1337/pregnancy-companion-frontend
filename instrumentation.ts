// Runs once when the server starts. On a REAL deploy it auto-registers the
// Telegram webhook so two-way chat works with no manual step.
//
// Guarded to the actual host (Railway) or an explicit opt-in — previously ANY
// local `npm start` with an https PUBLIC_WEBHOOK_URL (e.g. a dev tunnel) silently
// hijacked the production bot's webhook, breaking Telegram for everyone.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const onRealDeploy = !!process.env.RAILWAY_PUBLIC_DOMAIN || process.env.SET_TELEGRAM_WEBHOOK === "true";
  if (!onRealDeploy) return;
  try {
    const { telegramConfigured, setTelegramWebhook, telegramWebhookUrl } = await import("./lib/telegram");
    const { isPublicHttps } = await import("./lib/baseUrl");
    const url = telegramWebhookUrl();
    if (telegramConfigured() && isPublicHttps(url)) {
      const r = await setTelegramWebhook();
      console.log("[startup] Telegram webhook →", url, JSON.stringify(r).slice(0, 100));
    }
  } catch (e) {
    console.error("[startup] telegram webhook setup failed:", e);
  }
}
