-- Nerve Companion schema. All objects live in a dedicated schema so this app is
-- isolated from other apps sharing the same Postgres instance.

create schema if not exists preg_companion;

create table if not exists preg_companion.mothers (
  id                    uuid primary key default gen_random_uuid(),
  email                 text unique not null,
  password_hash         text not null,
  full_name             text not null,
  partner_name          text,
  phone                 text,
  whatsapp_number       text,
  due_date              date,
  current_week          int not null check (current_week between 1 and 42),
  weeks_completed       int default 0,
  trimester             text,
  first_pregnancy       boolean default true,
  dietary_restrictions  text,
  ethnicity             text,
  source                text default 'website',
  plan                  text not null default 'free',   -- 'free' | 'premium'
  last_sent_at          timestamptz,
  created_at            timestamptz not null default now()
);

create table if not exists preg_companion.weekly_updates (
  id                  uuid primary key default gen_random_uuid(),
  mother_id           uuid not null references preg_companion.mothers(id) on delete cascade,
  week_number         int not null,
  subject             text,
  baby_size           text,
  baby_development    text,
  symptoms            jsonb,
  weekly_tip          text,
  partner_section     jsonb,
  first_time_mom_tip  text,
  affirmation         text,
  meal_plan           jsonb,
  html_content        text,
  slug                text unique,
  sent_email          boolean default false,
  sent_whatsapp       boolean default false,
  created_at          timestamptz not null default now(),
  unique (mother_id, week_number)
);

create table if not exists preg_companion.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  mother_id   uuid not null references preg_companion.mothers(id) on delete cascade,
  role        text not null,   -- 'user' | 'assistant'
  content     text not null,
  week_number int,
  created_at  timestamptz not null default now()
);

create index if not exists idx_weekly_mother on preg_companion.weekly_updates(mother_id, week_number);
create index if not exists idx_chat_mother   on preg_companion.chat_messages(mother_id, created_at);

-- Daily symptom & mood journal
create table if not exists preg_companion.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  mother_id   uuid not null references preg_companion.mothers(id) on delete cascade,
  entry_date  date not null default current_date,
  mood        text,        -- 'great' | 'good' | 'okay' | 'low' | 'rough'
  symptoms    jsonb,       -- array of strings
  note        text,
  week_number int,
  created_at  timestamptz not null default now()
);
create index if not exists idx_journal_mother on preg_companion.journal_entries(mother_id, created_at desc);

-- Kick counter sessions
create table if not exists preg_companion.kick_sessions (
  id           uuid primary key default gen_random_uuid(),
  mother_id    uuid not null references preg_companion.mothers(id) on delete cascade,
  started_at   timestamptz not null,
  completed_at timestamptz,
  kicks        int not null default 0,
  week_number  int,
  created_at   timestamptz not null default now()
);
create index if not exists idx_kick_mother on preg_companion.kick_sessions(mother_id, created_at desc);

-- Admin-editable app settings (key/value)
create table if not exists preg_companion.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- Language preference (en | pcm | yo | ha | ig). Added post-launch, idempotent.
alter table preg_companion.mothers add column if not exists language text not null default 'en';

-- User customization: { tone, focus[], about } — personalises the AI.
alter table preg_companion.mothers add column if not exists preferences jsonb not null default '{}'::jsonb;

-- Ethnicity — curates the meal plan around local/cultural cuisine.
alter table preg_companion.mothers add column if not exists ethnicity text;

-- Telegram chat link (set when a mom links her Telegram to her account).
alter table preg_companion.mothers add column if not exists telegram_chat_id text;
alter table preg_companion.mothers add column if not exists telegram_link_token text;

-- Emergency next-of-kin contact (used by Emergency Mode).
alter table preg_companion.mothers add column if not exists emergency_contact_name text;
alter table preg_companion.mothers add column if not exists emergency_contact_phone text;

-- Family/partner share token — read-only weekly view, no login (Family Companion).
alter table preg_companion.mothers add column if not exists family_token text;
create index if not exists idx_mothers_telegram on preg_companion.mothers(telegram_chat_id);
create index if not exists idx_mothers_tgtoken on preg_companion.mothers(telegram_link_token);

-- Web-push subscriptions (one row per device/browser)
create table if not exists preg_companion.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  mother_id  uuid not null references preg_companion.mothers(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_mother on preg_companion.push_subscriptions(mother_id);

-- De-dupe log so reminders/milestones/daily/weekly pushes fire once each
create table if not exists preg_companion.notification_log (
  id         uuid primary key default gen_random_uuid(),
  mother_id  uuid not null references preg_companion.mothers(id) on delete cascade,
  kind       text not null,   -- 'weekly' | 'anc' | 'milestone' | 'daily' | 'broadcast'
  ref        text not null,   -- e.g. 'week-8', 'anc-20', 'milestone-13', 'daily-2026-06-17'
  created_at timestamptz not null default now(),
  unique (mother_id, kind, ref)
);

-- Vitals (self-logged or entered by a clinician)
create table if not exists preg_companion.vitals (
  id          uuid primary key default gen_random_uuid(),
  mother_id   uuid not null references preg_companion.mothers(id) on delete cascade,
  kind        text not null,   -- 'bp' | 'weight' | 'temp' | 'fhr' | 'glucose'
  value       numeric,         -- primary (systolic for bp)
  value2      numeric,         -- secondary (diastolic for bp)
  unit        text,
  note        text,
  source      text not null default 'self',   -- 'self' | 'clinician'
  week_number int,
  created_at  timestamptz not null default now()
);
create index if not exists idx_vitals_mother on preg_companion.vitals(mother_id, created_at desc);

-- Red-flag alerts raised from vitals (clinician portal reads these)
create table if not exists preg_companion.alerts (
  id          uuid primary key default gen_random_uuid(),
  mother_id   uuid not null references preg_companion.mothers(id) on delete cascade,
  level       text not null,   -- 'info' | 'warning' | 'urgent'
  kind        text not null,   -- 'bp' | 'fever' | 'fhr' | 'glucose' | 'weight'
  message     text not null,
  vital_id    uuid references preg_companion.vitals(id) on delete set null,
  status      text not null default 'open',   -- 'open' | 'reviewed' | 'resolved'
  reviewed_by text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_alerts_status on preg_companion.alerts(status, created_at desc);
create index if not exists idx_alerts_mother on preg_companion.alerts(mother_id, created_at desc);

-- Clinicians who can review alerts (human-in-the-loop portal)
create table if not exists preg_companion.clinicians (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  name          text not null,
  created_at    timestamptz not null default now()
);

-- Bump photo diary: weekly progress photos (image bytes stored in Postgres)
create table if not exists preg_companion.bump_photos (
  id          uuid primary key default gen_random_uuid(),
  mother_id   uuid not null references preg_companion.mothers(id) on delete cascade,
  week_number int,
  note        text,
  mime        text not null default 'image/jpeg',
  data        bytea not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_bump_mother on preg_companion.bump_photos(mother_id, created_at desc);

-- CHW (community health worker) who enrolled/owns this mother (reuses clinicians).
alter table preg_companion.mothers add column if not exists chw_id uuid references preg_companion.clinicians(id) on delete set null;
create index if not exists idx_mothers_chw on preg_companion.mothers(chw_id);
