// Telegram Bot API client — reliable two-way chat (no QR / no soft-bans).
import { publicBaseUrl } from "./baseUrl";

const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const API = `https://api.telegram.org/bot${TOKEN}`;

export function telegramConfigured(): boolean {
  return !!TOKEN;
}

export function telegramBotUsername(): string {
  return process.env.TELEGRAM_BOT_USERNAME || "bumply_bot";
}

export function telegramSecret(): string {
  return process.env.TELEGRAM_WEBHOOK_SECRET || process.env.WHATSAPP_WEBHOOK_SECRET || process.env.CRON_SECRET || "";
}

export function telegramWebhookUrl(): string {
  return `${publicBaseUrl()}/api/telegram/webhook`;
}

async function tg(method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!telegramConfigured()) return { ok: false, description: "not configured" };
  try {
    const r = await fetch(`${API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return (await r.json()) as Record<string, unknown>;
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : "request failed" };
  }
}

export async function getMe(): Promise<Record<string, unknown>> {
  return tg("getMe", {});
}

export async function sendChatAction(chatId: string | number, action = "typing"): Promise<void> {
  await tg("sendChatAction", { chat_id: chatId, action }).catch(() => {});
}

// Download a Telegram file (e.g. a voice note) to a Buffer.
export async function downloadTelegramFile(fileId: string): Promise<Buffer> {
  const info = await tg("getFile", { file_id: fileId });
  const path = (info.result as { file_path?: string })?.file_path;
  if (!path) throw new Error("no file_path");
  const r = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`download HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// Send an MP3 as a playable audio reply (Telegram sendAudio).
export async function sendVoiceReply(chatId: string | number, mp3: Buffer): Promise<{ sent: boolean; error?: string }> {
  if (!telegramConfigured()) return { sent: false };
  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("title", "Bumply 🌸");
    form.append("audio", new Blob([new Uint8Array(mp3)], { type: "audio/mpeg" }), "bumply.mp3");
    const r = await fetch(`${API}/sendAudio`, { method: "POST", body: form });
    const d = (await r.json()) as Record<string, unknown>;
    return { sent: !!d.ok, error: d.ok ? undefined : String(d.description || "") };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

export async function sendTelegram(chatId: string | number, text: string): Promise<{ sent: boolean; error?: string }> {
  // Telegram is sent WITHOUT parse_mode, so markdown asterisks would show as
  // literal ** characters — strip them; plain, properly spaced text only.
  const plain = text.replace(/\*+/g, "").replace(/[ \t]{2,}/g, " ");
  const d = await tg("sendMessage", { chat_id: chatId, text: plain });
  return { sent: !!d.ok, error: d.ok ? undefined : String(d.description || "") };
}

export async function setTelegramWebhook(): Promise<Record<string, unknown>> {
  return tg("setWebhook", {
    url: telegramWebhookUrl(),
    secret_token: telegramSecret() || undefined,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
}

export async function getWebhookInfo(): Promise<Record<string, unknown>> {
  return tg("getWebhookInfo", {});
}
