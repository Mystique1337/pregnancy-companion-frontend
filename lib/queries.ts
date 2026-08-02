import { sql } from "./db";
import { randomBytes } from "node:crypto";

export type Mother = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  partner_name: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  due_date: string | null;
  birth_date: string | null;
  current_week: number;
  weeks_completed: number | null;
  trimester: string | null;
  first_pregnancy: boolean | null;
  dietary_restrictions: string | null;
  ethnicity: string | null;
  source: string | null;
  plan: "free" | "premium";
  language: string | null;
  preferences: Record<string, unknown> | null;
  telegram_chat_id: string | null;
  telegram_link_token: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  family_token: string | null;
  last_sent_at: string | null;
  created_at: string;
  // Grant-readiness layer (equity, Three Delays, consent)
  state: string | null;
  lga: string | null;
  ward: string | null;
  facility_name: string | null;
  residence: string | null;        // 'urban' | 'rural'
  anc_attended: boolean | null;
  transport_name: string | null;
  transport_phone: string | null;
  transport_note: string | null;
  partner_phone: string | null;
  partner_opt_in: boolean | null;
  consent_at: string | null;
  consent_version: string | null;
  deleted_at: string | null;
};

export type WeeklyUpdate = {
  id: string;
  mother_id: string;
  week_number: number;
  subject: string | null;
  baby_size: string | null;
  baby_development: string | null;
  symptoms: { symptom: string; tip: string }[] | null;
  weekly_tip: string | null;
  partner_section: { title: string; description: string }[] | null;
  first_time_mom_tip: string | null;
  affirmation: string | null;
  meal_plan: Record<string, unknown> | null;
  html_content: string | null;
  slug: string | null;
  sent_email: boolean;
  sent_whatsapp: boolean;
  created_at: string;
};

export async function getMotherByEmail(email: string): Promise<Mother | null> {
  const rows = await sql<Mother[]>`select * from mothers where email = ${email.toLowerCase()} limit 1`;
  return rows[0] ?? null;
}

export async function getMotherById(id: string): Promise<Mother | null> {
  const rows = await sql<Mother[]>`select * from mothers where id = ${id} limit 1`;
  return rows[0] ?? null;
}

export async function updateMotherPassword(id: string, passwordHash: string): Promise<void> {
  await sql`update mothers set password_hash = ${passwordHash} where id = ${id}`;
}

// Match an inbound WhatsApp sender (any format) to a mother by the last 10 digits,
// which sidesteps country-code / leading-zero differences (e.g. +234 vs 0).
export async function getMotherByPhone(phone: string): Promise<Mother | null> {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 7) return null;
  const last10 = digits.slice(-10);
  const rows = await sql<Mother[]>`
    select * from mothers
    where right(regexp_replace(coalesce(whatsapp_number, ''), '\D', '', 'g'), 10) = ${last10}
       or right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = ${last10}
    order by created_at desc
    limit 1`;
  return rows[0] ?? null;
}

export async function createMother(m: {
  email: string;
  password_hash: string;
  full_name: string;
  partner_name?: string;
  phone?: string;
  whatsapp_number?: string;
  due_date?: string;
  current_week: number;
  weeks_completed: number;
  trimester: string;
  first_pregnancy: boolean;
  dietary_restrictions?: string;
  ethnicity?: string;
  source?: string;
  language?: string;
}): Promise<Mother> {
  const rows = await sql<Mother[]>`
    insert into mothers
      (email, password_hash, full_name, partner_name, phone, whatsapp_number, due_date,
       current_week, weeks_completed, trimester, first_pregnancy, dietary_restrictions, ethnicity, source, language)
    values
      (${m.email.toLowerCase()}, ${m.password_hash}, ${m.full_name}, ${m.partner_name ?? null},
       ${m.phone ?? null}, ${m.whatsapp_number ?? m.phone ?? null}, ${m.due_date ?? null},
       ${m.current_week}, ${m.weeks_completed}, ${m.trimester}, ${m.first_pregnancy},
       ${m.dietary_restrictions ?? null}, ${m.ethnicity ?? null}, ${m.source ?? "website"}, ${m.language ?? "en"})
    returning *`;
  return rows[0];
}

export async function updateMotherLanguage(id: string, language: string) {
  await sql`update mothers set language = ${language} where id = ${id}`;
}

export async function updateMotherPreferences(id: string, prefs: Record<string, unknown>) {
  await sql`update mothers set preferences = ${sql.json(prefs as Parameters<typeof sql.json>[0])} where id = ${id}`;
}

export async function updateEmergencyContact(id: string, name: string | null, phone: string | null) {
  await sql`update mothers set emergency_contact_name = ${name}, emergency_contact_phone = ${phone} where id = ${id}`;
}

export async function getMotherByTelegram(chatId: string): Promise<Mother | null> {
  const rows = await sql<Mother[]>`select * from mothers where telegram_chat_id = ${chatId} limit 1`;
  return rows[0] ?? null;
}

export async function linkTelegramChat(motherId: string, chatId: string | null) {
  await sql`update mothers set telegram_chat_id = ${chatId} where id = ${motherId}`;
}

// Per-mom link code shown in the app and pasted to the bot to connect.
export async function getOrCreateTelegramToken(motherId: string): Promise<string> {
  const rows = await sql<{ telegram_link_token: string | null }[]>`select telegram_link_token from mothers where id = ${motherId}`;
  if (rows[0]?.telegram_link_token) return rows[0].telegram_link_token;
  const token = randomBytes(5).toString("hex"); // 10-char code
  await sql`update mothers set telegram_link_token = ${token} where id = ${motherId}`;
  return token;
}

export async function getOrCreateFamilyToken(motherId: string): Promise<string> {
  const rows = await sql<{ family_token: string | null }[]>`select family_token from mothers where id = ${motherId}`;
  if (rows[0]?.family_token) return rows[0].family_token;
  const token = randomBytes(9).toString("hex"); // 18-char unguessable token
  await sql`update mothers set family_token = ${token} where id = ${motherId}`;
  return token;
}

export async function getMotherByFamilyToken(token: string): Promise<Mother | null> {
  if (!token) return null;
  const rows = await sql<Mother[]>`select * from mothers where family_token = ${token} limit 1`;
  return rows[0] ?? null;
}

export async function getMotherByTelegramToken(token: string): Promise<Mother | null> {
  if (!token) return null;
  const rows = await sql<Mother[]>`select * from mothers where telegram_link_token = ${token} limit 1`;
  return rows[0] ?? null;
}

export async function setPlan(id: string, plan: "free" | "premium") {
  await sql`update mothers set plan = ${plan} where id = ${id}`;
}

export async function listAllMothers(): Promise<Mother[]> {
  return sql<Mother[]>`select * from mothers order by created_at desc`;
}

export type AdminStats = {
  users: number; premium: number; free: number; new_week: number;
  updates: number; chats: number; journal: number; kicks: number;
};

export async function adminStats(): Promise<AdminStats> {
  const rows = await sql<Record<string, string>[]>`
    select
      (select count(*) from mothers)                                          as users,
      (select count(*) from mothers where plan = 'premium')                   as premium,
      (select count(*) from mothers where plan = 'free')                      as free,
      (select count(*) from mothers where created_at > now() - interval '7 days') as new_week,
      (select count(*) from weekly_updates)                                   as updates,
      (select count(*) from chat_messages)                                    as chats,
      (select count(*) from journal_entries)                                  as journal,
      (select count(*) from kick_sessions)                                    as kicks`;
  const r = rows[0] || {};
  const n = (k: string) => Number(r[k] || 0);
  return {
    users: n("users"), premium: n("premium"), free: n("free"), new_week: n("new_week"),
    updates: n("updates"), chats: n("chats"), journal: n("journal"), kicks: n("kicks"),
  };
}

export async function deleteMother(id: string) {
  await sql`delete from mothers where id = ${id}`;
}

// Aggregated, anonymised population-health view (for an admin / health-authority
// dashboard). No personal identifiers — counts only.
export type PopulationStats = {
  byTrimester: { label: string; count: number }[];
  byLanguage: { label: string; count: number }[];
  alertsByKind: { kind: string; total: number; open: number; urgent: number }[];
  totalAlerts: number;
  openAlerts: number;
  emergencies: number;
  moodFlags: number;
  ancReminders: number;
};

export async function populationStats(): Promise<PopulationStats> {
  const [tri, lang, alerts, notif] = await Promise.all([
    sql<{ trimester: string; count: string }[]>`
      select coalesce(trimester, 'unknown') as trimester, count(*) as count
      from mothers group by trimester order by count desc`,
    sql<{ language: string; count: string }[]>`
      select coalesce(language, 'en') as language, count(*) as count
      from mothers group by language order by count desc`,
    sql<{ kind: string; total: string; open: string; urgent: string }[]>`
      select kind,
             count(*) as total,
             count(*) filter (where status = 'open')   as open,
             count(*) filter (where level = 'urgent')  as urgent
      from alerts group by kind order by total desc`,
    sql<{ kind: string; count: string }[]>`
      select kind, count(*) as count from notification_log group by kind`,
  ]);

  const LANG_LABEL: Record<string, string> = { en: "English", pcm: "Pidgin", yo: "Yoruba", ha: "Hausa", ig: "Igbo" };
  const n = (v: string) => Number(v || 0);
  const alertsByKind = alerts.map((a) => ({ kind: a.kind, total: n(a.total), open: n(a.open), urgent: n(a.urgent) }));
  const notifMap = Object.fromEntries(notif.map((r) => [r.kind, n(r.count)]));

  return {
    byTrimester: tri.map((r) => ({ label: r.trimester, count: n(r.count) })),
    byLanguage: lang.map((r) => ({ label: LANG_LABEL[r.language] || r.language, count: n(r.count) })),
    alertsByKind,
    totalAlerts: alertsByKind.reduce((s, a) => s + a.total, 0),
    openAlerts: alertsByKind.reduce((s, a) => s + a.open, 0),
    emergencies: alertsByKind.filter((a) => a.kind === "emergency").reduce((s, a) => s + a.total, 0),
    moodFlags: alertsByKind.filter((a) => a.kind === "mood").reduce((s, a) => s + a.total, 0),
    ancReminders: notifMap["anc"] || 0,
  };
}

// --- Web-push subscriptions ---
export type PushSub = { id: string; mother_id: string; endpoint: string; p256dh: string; auth: string };

export async function savePushSubscription(motherId: string, s: { endpoint: string; p256dh: string; auth: string }) {
  await sql`
    insert into push_subscriptions (mother_id, endpoint, p256dh, auth)
    values (${motherId}, ${s.endpoint}, ${s.p256dh}, ${s.auth})
    on conflict (endpoint) do update
      set mother_id = excluded.mother_id, p256dh = excluded.p256dh, auth = excluded.auth`;
}

export async function deletePushSubscription(endpoint: string) {
  await sql`delete from push_subscriptions where endpoint = ${endpoint}`;
}

export async function listPushSubscriptions(motherId: string): Promise<PushSub[]> {
  return sql<PushSub[]>`select * from push_subscriptions where mother_id = ${motherId}`;
}

export async function listAllPushSubscriptions(): Promise<PushSub[]> {
  return sql<PushSub[]>`select * from push_subscriptions`;
}

// --- Notification de-dupe log (fire each reminder/milestone/etc. once) ---
export async function alreadyNotified(motherId: string, kind: string, ref: string): Promise<boolean> {
  const rows = await sql`select 1 from notification_log where mother_id = ${motherId} and kind = ${kind} and ref = ${ref} limit 1`;
  return rows.length > 0;
}

export async function markNotified(motherId: string, kind: string, ref: string) {
  await sql`insert into notification_log (mother_id, kind, ref) values (${motherId}, ${kind}, ${ref}) on conflict do nothing`;
}

// --- Vitals ---
export type Vital = {
  id: string; mother_id: string; kind: string;
  value: number | null; value2: number | null; unit: string | null;
  note: string | null; source: string; week_number: number | null; created_at: string;
};

export async function addVital(
  motherId: string,
  v: { kind: string; value?: number | null; value2?: number | null; unit?: string; note?: string; source?: string; week?: number }
): Promise<Vital> {
  const rows = await sql<Vital[]>`
    insert into vitals (mother_id, kind, value, value2, unit, note, source, week_number)
    values (${motherId}, ${v.kind}, ${v.value ?? null}, ${v.value2 ?? null}, ${v.unit ?? null},
            ${v.note ?? null}, ${v.source ?? "self"}, ${v.week ?? null})
    returning *`;
  return rows[0];
}

export async function listVitals(motherId: string, kind?: string, limit = 60): Promise<Vital[]> {
  if (kind)
    return sql<Vital[]>`select * from vitals where mother_id = ${motherId} and kind = ${kind} order by created_at desc limit ${limit}`;
  return sql<Vital[]>`select * from vitals where mother_id = ${motherId} order by created_at desc limit ${limit}`;
}

export async function latestVital(motherId: string, kind: string): Promise<Vital | null> {
  const rows = await sql<Vital[]>`select * from vitals where mother_id = ${motherId} and kind = ${kind} order by created_at desc limit 1`;
  return rows[0] ?? null;
}

// Postpartum: mark a mother as delivered (records baby's birth date; drives
// newborn danger-sign context + the immunization schedule).
export async function markDelivered(motherId: string, birthDate: string) {
  await sql`update mothers set birth_date = ${birthDate} where id = ${motherId}`;
}

// Delivered mothers whose baby is still within the immunization window (< ~18 months),
// for postpartum vaccine reminders.
export async function listPostpartumMothers(limit = 500): Promise<Mother[]> {
  return sql<Mother[]>`
    select * from mothers
    where birth_date is not null and birth_date > (current_date - interval '18 months')
    order by birth_date desc limit ${limit}`;
}

// --- Alerts ---
export type Alert = {
  id: string; mother_id: string; level: string; kind: string; message: string;
  vital_id: string | null; status: string; reviewed_by: string | null; created_at: string;
  outcome?: string | null; outcome_at?: string | null; outcome_by?: string | null;
};
export type AlertWithMother = Alert & { full_name: string; email: string; phone: string | null; whatsapp_number: string | null };

export async function createAlert(
  motherId: string,
  a: { level: string; kind: string; message: string; vitalId?: string }
): Promise<Alert> {
  const rows = await sql<Alert[]>`
    insert into alerts (mother_id, level, kind, message, vital_id)
    values (${motherId}, ${a.level}, ${a.kind}, ${a.message}, ${a.vitalId ?? null})
    returning *`;
  return rows[0];
}

export async function listAlertsForMother(motherId: string, limit = 20): Promise<Alert[]> {
  return sql<Alert[]>`select * from alerts where mother_id = ${motherId} order by created_at desc limit ${limit}`;
}

export async function listAlerts(status?: string, limit = 100): Promise<AlertWithMother[]> {
  if (status)
    return sql<AlertWithMother[]>`
      select a.*, m.full_name, m.email, m.phone, m.whatsapp_number
      from alerts a join mothers m on m.id = a.mother_id
      where a.status = ${status} order by a.created_at desc limit ${limit}`;
  return sql<AlertWithMother[]>`
    select a.*, m.full_name, m.email, m.phone, m.whatsapp_number
    from alerts a join mothers m on m.id = a.mother_id
    order by a.created_at desc limit ${limit}`;
}

export async function setAlertStatus(id: string, status: string, reviewedBy: string) {
  await sql`update alerts set status = ${status}, reviewed_by = ${reviewedBy} where id = ${id}`;
}

// Close-the-loop: record whether she actually reached care.
export async function setAlertOutcome(id: string, outcome: string, by: string) {
  await sql`update alerts set outcome = ${outcome}, outcome_at = now(), outcome_by = ${by}, status = 'resolved' where id = ${id}`;
}

export type OutcomeStats = { total: number; with_outcome: number; sought_care: number };
export async function outcomeStats(): Promise<OutcomeStats> {
  const rows = await sql<{ total: string; with_outcome: string; sought_care: string }[]>`
    select count(*) as total,
           count(*) filter (where outcome is not null) as with_outcome,
           count(*) filter (where outcome in ('sought_care','referred')) as sought_care
    from alerts where level in ('urgent','warning')`;
  const r = rows[0] || { total: "0", with_outcome: "0", sought_care: "0" };
  return { total: Number(r.total), with_outcome: Number(r.with_outcome), sought_care: Number(r.sought_care) };
}

// --- CHW / clinician impact report ---
// Aggregated program-impact metrics for the clinic dashboard + CSV export.
export type ImpactReport = {
  totalMothers: number;
  whatsappEnrolled: number;   // source in ('whatsapp','chw')
  withWhatsappNumber: number;
  delivered: number;          // birth_date is not null
  alertsUrgent: number;
  alertsWarning: number;
  alertsTotal: number;        // urgent + warning
  withOutcome: number;        // alerts (any level) with a recorded outcome
  soughtCare: number;
  referred: number;
  ok: number;
  noResponse: number;
  reachedCarePct: number;     // (sought_care + referred) / with_outcome
  avgHoursToOutcome: number;  // mean created_at -> outcome_at, in hours
};

export async function impactReport(): Promise<ImpactReport> {
  const [mothers, alerts] = await Promise.all([
    sql<{ total: string; whatsapp_enrolled: string; with_whatsapp: string; delivered: string }[]>`
      select count(*)                                                          as total,
             count(*) filter (where source in ('whatsapp','chw'))              as whatsapp_enrolled,
             count(*) filter (where whatsapp_number is not null)               as with_whatsapp,
             count(*) filter (where birth_date is not null)                    as delivered
      from mothers`,
    sql<{
      urgent: string; warning: string; with_outcome: string;
      sought_care: string; referred: string; ok: string; no_response: string;
      avg_hours: string | null;
    }[]>`
      select count(*) filter (where level = 'urgent')                          as urgent,
             count(*) filter (where level = 'warning')                         as warning,
             count(*) filter (where outcome is not null)                       as with_outcome,
             count(*) filter (where outcome = 'sought_care')                   as sought_care,
             count(*) filter (where outcome = 'referred')                      as referred,
             count(*) filter (where outcome = 'ok')                            as ok,
             count(*) filter (where outcome = 'no_response')                   as no_response,
             avg(extract(epoch from (outcome_at - created_at)) / 3600.0)
               filter (where outcome_at is not null)                           as avg_hours
      from alerts`,
  ]);
  const m = mothers[0] || {};
  const a = alerts[0] || {};
  const n = (v: string | null | undefined) => Number(v || 0);
  const withOutcome = n(a.with_outcome);
  const reached = n(a.sought_care) + n(a.referred);
  return {
    totalMothers: n(m.total),
    whatsappEnrolled: n(m.whatsapp_enrolled),
    withWhatsappNumber: n(m.with_whatsapp),
    delivered: n(m.delivered),
    alertsUrgent: n(a.urgent),
    alertsWarning: n(a.warning),
    alertsTotal: n(a.urgent) + n(a.warning),
    withOutcome,
    soughtCare: n(a.sought_care),
    referred: n(a.referred),
    ok: n(a.ok),
    noResponse: n(a.no_response),
    reachedCarePct: withOutcome ? Math.round((reached / withOutcome) * 100) : 0,
    avgHoursToOutcome: a.avg_hours != null ? Math.round(n(a.avg_hours) * 10) / 10 : 0,
  };
}

// Flat alert rows for CSV export (alerts joined to mothers).
export type AlertExportRow = {
  full_name: string;
  phone: string | null;
  whatsapp_number: string | null;
  level: string;
  kind: string;
  message: string;
  status: string;
  outcome: string | null;
  created_at: string;
  outcome_at: string | null;
  outcome_by: string | null;
};

export async function alertsForExport(limit = 1000): Promise<AlertExportRow[]> {
  return sql<AlertExportRow[]>`
    select m.full_name, m.phone, m.whatsapp_number,
           a.level, a.kind, a.message, a.status,
           a.outcome, a.created_at, a.outcome_at, a.outcome_by
    from alerts a join mothers m on m.id = a.mother_id
    order by a.created_at desc limit ${limit}`;
}

// --- WhatsApp self-onboarding state ---
export type Onboarding = { phone: string; step: string; data: Record<string, unknown> };
export async function getOnboarding(phone: string): Promise<Onboarding | null> {
  const rows = await sql<Onboarding[]>`select phone, step, data from wa_onboarding where phone = ${phone} limit 1`;
  return rows[0] ?? null;
}
export async function setOnboarding(phone: string, step: string, data: Record<string, unknown>) {
  await sql`
    insert into wa_onboarding (phone, step, data) values (${phone}, ${step}, ${sql.json(data as Parameters<typeof sql.json>[0])})
    on conflict (phone) do update set step = ${step}, data = ${sql.json(data as Parameters<typeof sql.json>[0])}`;
}
export async function clearOnboarding(phone: string) {
  await sql`delete from wa_onboarding where phone = ${phone}`;
}

// --- CHW co-pilot: a community health worker enrolls + monitors her own mothers ---
export async function assignChw(motherId: string, chwId: string): Promise<void> {
  await sql`update mothers set chw_id = ${chwId} where id = ${motherId}`;
}

export type ChwMother = Mother & { open_alerts: number; last_alert_at: string | null };
export async function listMothersForChw(chwId: string): Promise<ChwMother[]> {
  return sql<ChwMother[]>`
    select m.*,
      (select count(*) from alerts a where a.mother_id = m.id and a.status = 'open')::int as open_alerts,
      (select max(a.created_at) from alerts a where a.mother_id = m.id) as last_alert_at
    from mothers m
    where m.chw_id = ${chwId}
    order by open_alerts desc, m.created_at desc`;
}

export async function listAlertsForChw(chwId: string, limit = 100): Promise<AlertWithMother[]> {
  return sql<AlertWithMother[]>`
    select a.*, m.full_name, m.email, m.phone, m.whatsapp_number
    from alerts a join mothers m on m.id = a.mother_id
    where m.chw_id = ${chwId}
    order by a.created_at desc limit ${limit}`;
}

// --- Clinicians ---
export type Clinician = { id: string; email: string; password_hash: string; name: string; created_at: string };

export async function getClinicianByEmail(email: string): Promise<Clinician | null> {
  const rows = await sql<Clinician[]>`select * from clinicians where email = ${email.toLowerCase()} limit 1`;
  return rows[0] ?? null;
}

export async function createClinician(email: string, passwordHash: string, name: string): Promise<Clinician> {
  const rows = await sql<Clinician[]>`
    insert into clinicians (email, password_hash, name)
    values (${email.toLowerCase()}, ${passwordHash}, ${name})
    on conflict (email) do update set password_hash = excluded.password_hash, name = excluded.name
    returning *`;
  return rows[0];
}

export async function listClinicians(): Promise<{ id: string; email: string; name: string; created_at: string }[]> {
  return sql`select id, email, name, created_at from clinicians order by created_at desc`;
}

// Recent vitals for a mother (clinician view).
export async function recentVitalsFor(motherId: string, limit = 8): Promise<Vital[]> {
  return sql<Vital[]>`select * from vitals where mother_id = ${motherId} order by created_at desc limit ${limit}`;
}

export async function setUpdateSent(updateId: string, channel: "email" | "whatsapp") {
  if (channel === "email") await sql`update weekly_updates set sent_email = true where id = ${updateId}`;
  else await sql`update weekly_updates set sent_whatsapp = true where id = ${updateId}`;
}

export async function updateMotherWeek(id: string, week: number, trimester: string) {
  await sql`update mothers set current_week = ${week}, trimester = ${trimester} where id = ${id}`;
}

export async function listWeeklyUpdates(motherId: string): Promise<WeeklyUpdate[]> {
  return sql<WeeklyUpdate[]>`
    select * from weekly_updates where mother_id = ${motherId} order by week_number desc`;
}

export async function getWeeklyUpdateByWeek(motherId: string, week: number): Promise<WeeklyUpdate | null> {
  const rows = await sql<WeeklyUpdate[]>`
    select * from weekly_updates where mother_id = ${motherId} and week_number = ${week} limit 1`;
  return rows[0] ?? null;
}

export async function getWeeklyUpdateBySlug(slug: string): Promise<WeeklyUpdate | null> {
  const rows = await sql<WeeklyUpdate[]>`select * from weekly_updates where slug = ${slug} limit 1`;
  return rows[0] ?? null;
}

export async function recentChat(motherId: string, limit = 20) {
  const rows = await sql<{ role: string; content: string }[]>`
    select role, content from chat_messages
    where mother_id = ${motherId} order by created_at desc limit ${limit}`;
  return rows.reverse();
}

export async function saveChat(motherId: string, role: "user" | "assistant", content: string, week: number) {
  await sql`insert into chat_messages (mother_id, role, content, week_number)
            values (${motherId}, ${role}, ${content}, ${week})`;
}

// --- Journal ---
export type JournalEntry = {
  id: string;
  mother_id: string;
  entry_date: string;
  mood: string | null;
  symptoms: string[] | null;
  note: string | null;
  week_number: number | null;
  created_at: string;
};

export async function createJournalEntry(
  motherId: string,
  e: { mood?: string; symptoms?: string[]; note?: string; week?: number }
): Promise<JournalEntry> {
  const rows = await sql<JournalEntry[]>`
    insert into journal_entries (mother_id, mood, symptoms, note, week_number)
    values (${motherId}, ${e.mood ?? null}, ${sql.json(e.symptoms ?? [])}, ${e.note ?? null}, ${e.week ?? null})
    returning *`;
  return rows[0];
}

export async function listJournalEntries(motherId: string, limit = 60): Promise<JournalEntry[]> {
  return sql<JournalEntry[]>`
    select * from journal_entries where mother_id = ${motherId} order by created_at desc limit ${limit}`;
}

// --- Bump photo diary ---
export type BumpPhoto = { id: string; mother_id: string; week_number: number | null; note: string | null; mime: string; created_at: string };

export async function addBumpPhoto(motherId: string, p: { week: number | null; note?: string; mime: string; data: Buffer }): Promise<BumpPhoto> {
  const rows = await sql<BumpPhoto[]>`
    insert into bump_photos (mother_id, week_number, note, mime, data)
    values (${motherId}, ${p.week ?? null}, ${p.note ?? null}, ${p.mime}, ${p.data})
    returning id, mother_id, week_number, note, mime, created_at`;
  return rows[0];
}

export async function listBumpPhotos(motherId: string, limit = 60): Promise<BumpPhoto[]> {
  // never selects the bytea blob — only metadata; image bytes are streamed separately
  return sql<BumpPhoto[]>`
    select id, mother_id, week_number, note, mime, created_at
    from bump_photos where mother_id = ${motherId} order by created_at desc limit ${limit}`;
}

export async function getBumpPhotoData(id: string, motherId: string): Promise<{ mime: string; data: Buffer } | null> {
  const rows = await sql<{ mime: string; data: Buffer | string }[]>`
    select mime, encode(data, 'hex') as data from bump_photos where id = ${id} and mother_id = ${motherId} limit 1`;
  const row = rows[0];
  if (!row) return null;
  // Direct-PG returns a Buffer; the REST bridge returns a hex string — normalise to Buffer.
  const data = Buffer.isBuffer(row.data) ? row.data : Buffer.from(String(row.data), "hex");
  return { mime: row.mime, data };
}

export async function deleteBumpPhoto(id: string, motherId: string): Promise<void> {
  await sql`delete from bump_photos where id = ${id} and mother_id = ${motherId}`;
}

export async function recentJournalSummary(motherId: string, limit = 5): Promise<string> {
  const rows = await sql<JournalEntry[]>`
    select * from journal_entries where mother_id = ${motherId} order by created_at desc limit ${limit}`;
  if (rows.length === 0) return "";
  return rows
    .map((r) => {
      const s = (r.symptoms || []).join(", ");
      return `- ${r.entry_date}: mood ${r.mood || "n/a"}${s ? `, symptoms: ${s}` : ""}${r.note ? `, note: "${r.note}"` : ""}`;
    })
    .join("\n");
}

// --- Kick counter ---
export type KickSession = {
  id: string;
  mother_id: string;
  started_at: string;
  completed_at: string | null;
  kicks: number;
  week_number: number | null;
  created_at: string;
};

export async function saveKickSession(
  motherId: string,
  s: { started_at: string; completed_at?: string; kicks: number; week?: number }
): Promise<KickSession> {
  const rows = await sql<KickSession[]>`
    insert into kick_sessions (mother_id, started_at, completed_at, kicks, week_number)
    values (${motherId}, ${s.started_at}, ${s.completed_at ?? null}, ${s.kicks}, ${s.week ?? null})
    returning *`;
  return rows[0];
}

export async function listKickSessions(motherId: string, limit = 20): Promise<KickSession[]> {
  return sql<KickSession[]>`
    select * from kick_sessions where mother_id = ${motherId} order by created_at desc limit ${limit}`;
}

// ============================================================================
// Grant-readiness layer: evidence, equity, safety, Three Delays.
// ============================================================================

// --- Audit trail (#5/#6): every AI + clinical action is recorded ------------
export type AuditEntry = {
  mother_id?: string | null;
  actor: "ai" | "chw" | "mother" | "system";
  action: string;
  channel?: string | null;
  summary?: string | null;
  meta?: Record<string, unknown>;
};

/** Fire-and-forget audit write — must never break a mother's conversation. */
export function logAudit(e: AuditEntry): void {
  void sql`
    insert into audit_log (mother_id, actor, action, channel, summary, meta)
    values (${e.mother_id ?? null}, ${e.actor}, ${e.action}, ${e.channel ?? null}, ${e.summary ?? null},
            ${sql.json((e.meta ?? {}) as Parameters<typeof sql.json>[0])})`
    .catch((err) => console.error("audit write failed:", err));
}

export type AuditRow = { id: string; mother_id: string | null; actor: string; action: string; channel: string | null; summary: string | null; created_at: string };
export async function recentAudit(limit = 100): Promise<AuditRow[]> {
  return sql<AuditRow[]>`
    select id::text, mother_id::text, actor, action, channel, summary, created_at
    from audit_log order by created_at desc limit ${limit}`;
}

// --- Time-to-care + referral loop (#2/#11) ----------------------------------
/** Issue a referral for an alert; the short code is what the facility confirms. */
export async function setAlertReferral(id: string, code: string, facility: string | null) {
  await sql`update alerts set referral_code = ${code}, referred_at = now(), facility_name = ${facility} where id = ${id}`;
}

/** A facility/CHW confirms she arrived. Returns the alert, or null if unknown code. */
export async function confirmArrivalByCode(code: string, facility?: string | null): Promise<Alert | null> {
  const rows = await sql<Alert[]>`
    update alerts set arrived_at = coalesce(arrived_at, now()),
                      facility_name = coalesce(${facility ?? null}, facility_name),
                      outcome = coalesce(outcome, 'sought_care'),
                      outcome_at = coalesce(outcome_at, now()),
                      status = 'resolved'
    where upper(referral_code) = upper(${code}) returning *`;
  return rows[0] ?? null;
}

export type TimeToCare = {
  referrals: number;        // alerts where a referral was issued
  arrivals: number;         // alerts with a confirmed arrival
  arrivalRatePct: number;
  medianHours: number;      // danger sign -> facility arrival
  fastestHours: number;
};

/** THE outcome metric: median hours from danger sign to facility arrival. */
export async function timeToCare(): Promise<TimeToCare> {
  const rows = await sql<{ referrals: string; arrivals: string; median_h: string | null; fastest_h: string | null }[]>`
    select count(*) filter (where referral_code is not null)                      as referrals,
           count(*) filter (where arrived_at is not null)                          as arrivals,
           percentile_cont(0.5) within group (
             order by extract(epoch from (arrived_at - created_at)) / 3600.0
           ) filter (where arrived_at is not null)                                 as median_h,
           min(extract(epoch from (arrived_at - created_at)) / 3600.0)
             filter (where arrived_at is not null)                                 as fastest_h
    from alerts`;
  const r = rows[0] || { referrals: "0", arrivals: "0", median_h: null, fastest_h: null };
  const referrals = Number(r.referrals), arrivals = Number(r.arrivals);
  return {
    referrals, arrivals,
    arrivalRatePct: referrals ? Math.round((arrivals / referrals) * 100) : 0,
    medianHours: r.median_h ? Math.round(Number(r.median_h) * 10) / 10 : 0,
    fastestHours: r.fastest_h ? Math.round(Number(r.fastest_h) * 10) / 10 : 0,
  };
}

// --- Equity / reach report (#4) ---------------------------------------------
export type ReachReport = {
  total: number;
  rural: number; urban: number; locationKnown: number;
  ruralPct: number;
  newToAnc: number;            // had NOT attended ANC before Bumply
  firstPregnancy: number;
  byLanguage: { language: string; n: number }[];
  byState: { state: string; n: number }[];
  withTransportPlan: number;
  withPartnerChannel: number;
  consented: number;
};

export async function reachReport(): Promise<ReachReport> {
  const [agg, langs, states] = await Promise.all([
    sql<Record<string, string>[]>`
      select count(*)                                                    as total,
             count(*) filter (where residence = 'rural')                 as rural,
             count(*) filter (where residence = 'urban')                 as urban,
             count(*) filter (where residence is not null)               as location_known,
             count(*) filter (where anc_attended = false)                as new_to_anc,
             count(*) filter (where first_pregnancy)                     as first_pregnancy,
             count(*) filter (where transport_phone is not null)         as with_transport,
             count(*) filter (where partner_opt_in)                      as with_partner,
             count(*) filter (where consent_at is not null)              as consented
      from mothers where deleted_at is null`,
    sql<{ language: string; n: string }[]>`
      select coalesce(language,'en') as language, count(*) as n from mothers
      where deleted_at is null group by 1 order by count(*) desc limit 8`,
    sql<{ state: string; n: string }[]>`
      select coalesce(state,'unknown') as state, count(*) as n from mothers
      where deleted_at is null group by 1 order by count(*) desc limit 8`,
  ]);
  const a = agg[0] || {};
  const total = Number(a.total || 0), rural = Number(a.rural || 0), known = Number(a.location_known || 0);
  return {
    total, rural, urban: Number(a.urban || 0), locationKnown: known,
    ruralPct: known ? Math.round((rural / known) * 100) : 0,
    newToAnc: Number(a.new_to_anc || 0),
    firstPregnancy: Number(a.first_pregnancy || 0),
    byLanguage: langs.map((l) => ({ language: l.language, n: Number(l.n) })),
    byState: states.map((s) => ({ state: s.state, n: Number(s.n) })),
    withTransportPlan: Number(a.with_transport || 0),
    withPartnerChannel: Number(a.with_partner || 0),
    consented: Number(a.consented || 0),
  };
}

// --- Profile fields: equity, transport plan, partner channel ----------------
export type MotherProfilePatch = Partial<Pick<Mother,
  "state" | "lga" | "ward" | "facility_name" | "residence" | "anc_attended" |
  "transport_name" | "transport_phone" | "transport_note" | "partner_phone" | "partner_opt_in">>;

/** Update only the provided profile fields (whitelisted keys, one statement each). */
export async function updateMotherProfile(id: string, patch: MotherProfilePatch): Promise<void> {
  const setters: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) setters[k] = v;
  const keys = Object.keys(setters);
  if (!keys.length) return;
  for (const k of keys) {
    // Whitelisted column names only — never interpolate user input as SQL.
    switch (k) {
      case "state": await sql`update mothers set state = ${setters[k] as string} where id = ${id}`; break;
      case "lga": await sql`update mothers set lga = ${setters[k] as string} where id = ${id}`; break;
      case "ward": await sql`update mothers set ward = ${setters[k] as string} where id = ${id}`; break;
      case "facility_name": await sql`update mothers set facility_name = ${setters[k] as string} where id = ${id}`; break;
      case "residence": await sql`update mothers set residence = ${setters[k] as string} where id = ${id}`; break;
      case "anc_attended": await sql`update mothers set anc_attended = ${setters[k] as boolean} where id = ${id}`; break;
      case "transport_name": await sql`update mothers set transport_name = ${setters[k] as string} where id = ${id}`; break;
      case "transport_phone": await sql`update mothers set transport_phone = ${setters[k] as string} where id = ${id}`; break;
      case "transport_note": await sql`update mothers set transport_note = ${setters[k] as string} where id = ${id}`; break;
      case "partner_phone": await sql`update mothers set partner_phone = ${setters[k] as string} where id = ${id}`; break;
      case "partner_opt_in": await sql`update mothers set partner_opt_in = ${setters[k] as boolean} where id = ${id}`; break;
    }
  }
}

// --- Consent + right to erasure (#5) ----------------------------------------
export async function recordConsent(id: string, version: string) {
  await sql`update mothers set consent_at = now(), consent_version = ${version} where id = ${id}`;
  logAudit({ mother_id: id, actor: "mother", action: "consent", summary: `consented to ${version}` });
}

/** NDPA right to erasure: wipe her content, keep an anonymous outcome row for M&E. */
export async function eraseMotherData(id: string): Promise<void> {
  await sql`delete from chat_messages where mother_id = ${id}`;
  await sql`delete from journal_entries where mother_id = ${id}`;
  await sql`delete from bump_photos where mother_id = ${id}`;
  await sql`delete from vitals where mother_id = ${id}`;
  await sql`update misinfo_checks set mother_id = null where mother_id = ${id}`;
  await sql`update audit_log set mother_id = null where mother_id = ${id}`;
  await sql`
    update mothers set deleted_at = now(), full_name = 'Deleted user', email = concat('deleted-', id, '@bumply.invalid'),
      phone = null, whatsapp_number = null, telegram_chat_id = null, partner_phone = null,
      transport_name = null, transport_phone = null, transport_note = null, preferences = null
    where id = ${id}`;
  logAudit({ actor: "mother", action: "data_deleted", summary: "erasure request completed" });
}

// --- Misinformation checks (#7) — also builds the myths dataset -------------
export async function logMisinfoCheck(motherId: string | null, claim: string, verdict: string, language: string | null, channel: string) {
  await sql`
    insert into misinfo_checks (mother_id, claim, verdict, language, channel)
    values (${motherId}, ${claim.slice(0, 500)}, ${verdict}, ${language}, ${channel})`;
}

export type MythRow = { claim: string; verdict: string; n: number };
export async function topMyths(limit = 20): Promise<MythRow[]> {
  const rows = await sql<{ claim: string; verdict: string; n: string }[]>`
    select claim, verdict, count(*) as n from misinfo_checks
    group by claim, verdict order by count(*) desc limit ${limit}`;
  return rows.map((r) => ({ claim: r.claim, verdict: r.verdict, n: Number(r.n) }));
}

export async function misinfoStats(): Promise<{ total: number; falseClaims: number }> {
  const rows = await sql<{ total: string; false_claims: string }[]>`
    select count(*) as total, count(*) filter (where verdict = 'false') as false_claims from misinfo_checks`;
  return { total: Number(rows[0]?.total || 0), falseClaims: Number(rows[0]?.false_claims || 0) };
}

// --- "Flag this answer" (#6) -------------------------------------------------
export async function flagAiAnswer(motherId: string | null, message: string, reason: string, by: string) {
  await sql`insert into ai_feedback (mother_id, message, reason, flagged_by) values (${motherId}, ${message.slice(0, 2000)}, ${reason}, ${by})`;
}

// --- CHW prioritisation worklist (#10) --------------------------------------
export type WorklistRow = {
  id: string; full_name: string; phone: string | null; whatsapp_number: string | null;
  current_week: number; language: string | null; open_alerts: number; urgent_alerts: number;
  last_alert_at: string | null; last_message_at: string | null; days_silent: number | null;
  transport_phone: string | null; anc_attended: boolean | null;
};

/** Every mother a CHW is responsible for, with the signals that drive priority. */
export async function chwWorklist(chwId: string): Promise<WorklistRow[]> {
  return sql<WorklistRow[]>`
    select m.id::text, m.full_name, m.phone, m.whatsapp_number, m.current_week, m.language,
           m.transport_phone, m.anc_attended,
           coalesce(a.open_alerts, 0)::int   as open_alerts,
           coalesce(a.urgent_alerts, 0)::int as urgent_alerts,
           a.last_alert_at,
           c.last_message_at,
           case when c.last_message_at is null then null
                else floor(extract(epoch from (now() - c.last_message_at)) / 86400)::int end as days_silent
    from mothers m
    left join (
      select mother_id,
             count(*) filter (where status = 'open')                        as open_alerts,
             count(*) filter (where status = 'open' and level = 'urgent')   as urgent_alerts,
             max(created_at)                                                as last_alert_at
      from alerts group by mother_id
    ) a on a.mother_id = m.id
    left join (
      select mother_id, max(created_at) as last_message_at from chat_messages group by mother_id
    ) c on c.mother_id = m.id
    where m.chw_id = ${chwId} and m.deleted_at is null
    order by coalesce(a.urgent_alerts,0) desc, coalesce(a.open_alerts,0) desc, c.last_message_at asc nulls first
    limit 200`;
}

// --- DHIS2 / HMIS aggregate (#15) -------------------------------------------
export type Hmis = {
  mothersEnrolled: number; ancReminders: number; dangerSignsDetected: number;
  referralsIssued: number; arrivalsConfirmed: number; deliveries: number; immunisationReminders: number;
};
export async function hmisAggregate(sinceIso: string, untilIso: string): Promise<Hmis> {
  const [m, a, n] = await Promise.all([
    sql<Record<string, string>[]>`
      select count(*) filter (where created_at >= ${sinceIso} and created_at < ${untilIso}) as enrolled,
             count(*) filter (where birth_date is not null and birth_date >= ${sinceIso}::date and birth_date < ${untilIso}::date) as deliveries
      from mothers where deleted_at is null`,
    sql<Record<string, string>[]>`
      select count(*) filter (where kind = 'danger-sign')                       as danger,
             count(*) filter (where referral_code is not null)                  as referrals,
             count(*) filter (where arrived_at is not null)                     as arrivals
      from alerts where created_at >= ${sinceIso} and created_at < ${untilIso}`,
    sql<Record<string, string>[]>`
      select count(*) filter (where kind = 'anc')          as anc,
             count(*) filter (where kind = 'immunization') as imm
      from notification_log where created_at >= ${sinceIso} and created_at < ${untilIso}`,
  ]);
  return {
    mothersEnrolled: Number(m[0]?.enrolled || 0),
    deliveries: Number(m[0]?.deliveries || 0),
    dangerSignsDetected: Number(a[0]?.danger || 0),
    referralsIssued: Number(a[0]?.referrals || 0),
    arrivalsConfirmed: Number(a[0]?.arrivals || 0),
    ancReminders: Number(n[0]?.anc || 0),
    immunisationReminders: Number(n[0]?.imm || 0),
  };
}
