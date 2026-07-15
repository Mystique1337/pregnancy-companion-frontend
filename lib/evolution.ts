// Thin client for a self-hosted Evolution API (v2) WhatsApp gateway.
// Outbound sending + instance lifecycle (create / QR connect / state / logout) + webhook config.
// All config via env; every call is a no-op-safe { ok, error } result so callers never throw.

import { publicBaseUrl } from "./baseUrl";

const BASE = (process.env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
const KEY = process.env.EVOLUTION_API_KEY || "";
export const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || "bumply";
const VERSION = (process.env.EVOLUTION_API_VERSION || "v2").toLowerCase();

export function evolutionConfigured(): boolean {
  return !!(BASE && KEY);
}

// Secret appended to the inbound webhook URL so only Evolution can post to us.
export function webhookSecret(): string {
  return process.env.WHATSAPP_WEBHOOK_SECRET || process.env.CRON_SECRET || "";
}

export function webhookUrl(): string {
  const base = publicBaseUrl();
  const s = webhookSecret();
  return `${base}/api/whatsapp/webhook${s ? `?secret=${encodeURIComponent(s)}` : ""}`;
}

type Result<T = unknown> = { ok: boolean; status?: number; data?: T; error?: string };

async function evo<T = unknown>(path: string, init?: RequestInit): Promise<Result<T>> {
  if (!evolutionConfigured()) return { ok: false, error: "Evolution API not configured" };
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { apikey: KEY, "Content-Type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = undefined;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      if (data && typeof data === "object" && "message" in data) {
        msg = String((data as Record<string, unknown>).message);
      } else if (typeof data === "string" && data) {
        msg = data;
      }
      return { ok: false, status: res.status, error: msg, data: data as T };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "request failed" };
  }
}

// Digits only, no leading +. Evolution wants e.g. 2348012345678.
export function normalizeNumber(raw: string): string {
  return String(raw || "").replace(/\D/g, "");
}

/** Create the WhatsApp instance (Baileys / QR). Idempotent-ish: a 403 "already in use" is treated as fine. */
export async function createInstance(): Promise<Result> {
  const r = await evo("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: EVOLUTION_INSTANCE,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
    }),
  });
  // "already in use" is fine — the instance exists. Evolution nests that message
  // under data.response.message, so check the whole payload, not just r.error.
  const blob = `${r.error || ""} ${JSON.stringify(r.data || "")}`;
  if (!r.ok && /already in use|already exists/i.test(blob)) return { ok: true, data: r.data };
  return r;
}

/** Register our inbound webhook (MESSAGES_UPSERT) so two-way chat works. */
export async function setWebhook(): Promise<Result> {
  return evo(`/webhook/set/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: webhookUrl(),
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT"],
      },
    }),
  });
}

export type ConnectInfo = { base64?: string; code?: string; pairingCode?: string };
/** Start/refresh the connection and return the QR (base64 image) + pairing code to scan. */
export async function connectInstance(): Promise<Result<ConnectInfo>> {
  return evo<ConnectInfo>(`/instance/connect/${EVOLUTION_INSTANCE}`, { method: "GET" });
}

export type StateInfo = { instance?: { instanceName?: string; state?: string }; state?: string };
/** "open" = connected, "connecting" = waiting for scan, "close" = disconnected. */
export async function connectionState(): Promise<Result<StateInfo>> {
  return evo<StateInfo>(`/instance/connectionState/${EVOLUTION_INSTANCE}`, { method: "GET" });
}

/** The connected WhatsApp number / profile name for OUR instance, if any. */
export async function getInstanceInfo(): Promise<Result> {
  const r = await evo(`/instance/fetchInstances?instanceName=${encodeURIComponent(EVOLUTION_INSTANCE)}`, { method: "GET" });
  if (r.ok && Array.isArray(r.data)) {
    const match = (r.data as Array<Record<string, unknown>>).find(
      (i) => i?.name === EVOLUTION_INSTANCE || i?.instanceName === EVOLUTION_INSTANCE
    );
    return { ok: true, data: match ? [match] : [] };
  }
  return r;
}

export async function logoutInstance(): Promise<Result> {
  return evo(`/instance/logout/${EVOLUTION_INSTANCE}`, { method: "DELETE" });
}

// --- Anti-ban ---------------------------------------------------------------
// WhatsApp bans unofficial (Baileys) numbers that behave like bots: taking calls,
// blasting identical messages with no typing, replying in groups, etc. These
// settings + humanised send (typing presence + jittered delay) reduce that risk.
// Default OFF: the typing-presence delay can make some Baileys sessions silently
// fail to flush messages. Opt back in with WHATSAPP_SEND_DELAY_MS once delivery is stable.
const SEND_DELAY_BASE = Number(process.env.WHATSAPP_SEND_DELAY_MS || 0);
const SEND_DELAY_JITTER = Number(process.env.WHATSAPP_SEND_DELAY_JITTER_MS || 0);

export function humanDelayMs(): number {
  return SEND_DELAY_BASE + Math.floor(Math.random() * Math.max(0, SEND_DELAY_JITTER));
}

/** Apply recommended anti-ban settings to the instance. */
export async function applyAntiBanSettings(): Promise<Result> {
  return evo(`/settings/set/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    body: JSON.stringify({
      rejectCall: true,
      msgCall: "Hi! I can't take calls here 🌸 Please send me a message and I'll reply.",
      groupsIgnore: true, // never engage in groups
      alwaysOnline: false, // 24/7 online looks bot-like
      readMessages: true,
      readStatus: false,
      syncFullHistory: false,
    }),
  });
}

/** Send a plain-text WhatsApp message with a human-like typing delay. */
export async function sendText(to: string, text: string): Promise<Result> {
  const number = normalizeNumber(to);
  if (!number) return { ok: false, error: "no phone number" };
  const delay = humanDelayMs(); // 0 by default; Evolution shows "typing…" for this long before sending
  const body =
    VERSION === "v1"
      ? { number, ...(delay > 0 ? { options: { delay, presence: "composing" } } : {}), textMessage: { text } }
      : { number, text, ...(delay > 0 ? { delay } : {}) };
  return evo(`/message/sendText/${EVOLUTION_INSTANCE}`, { method: "POST", body: JSON.stringify(body) });
}

/** Download an inbound media message (e.g. a voice note) as raw bytes. */
export async function downloadWhatsAppMedia(messageRecord: unknown): Promise<Buffer | null> {
  const r = await evo<{ base64?: string }>(`/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    body: JSON.stringify({ message: messageRecord, convertToMp4: false }),
  });
  if (!r.ok || !r.data?.base64) return null;
  try { return Buffer.from(r.data.base64, "base64"); } catch { return null; }
}

/** Send a WhatsApp voice note (PTT). `audio` = MP3 bytes or a URL. */
export async function sendWhatsAppAudio(to: string, audio: Buffer | string): Promise<Result> {
  const number = normalizeNumber(to);
  if (!number) return { ok: false, error: "no phone number" };
  const payload = typeof audio === "string" ? audio : audio.toString("base64");
  return evo(`/message/sendWhatsAppAudio/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    body: JSON.stringify({ number, audio: payload }),
  });
}
