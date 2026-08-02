# Data Protection — NDPA 2023 Mapping

*Version 1.0 · July 2026 · controller: the Bumply project team · contact: privacy@bumply.mom*

Bumply processes the health data of pregnant and postpartum women in Nigeria over
WhatsApp, Telegram and the web. Health data is **sensitive personal data** under the
Nigeria Data Protection Act 2023 (NDPA), so this document states exactly what is held,
where, on what basis, who touches it, and what happens when a mother asks for it to be
deleted or when something goes wrong. The mother-facing version of this is `/privacy`.

**Role.** The Bumply project team is the **data controller**. The services in §5 are
**data processors** or independent transport providers. The database is self-hosted
infrastructure the team controls, not a third-party health platform.

---

## 1. Data inventory (table by table)

Schema: `preg_companion` in a self-hosted Supabase/Postgres. Source of truth:
`db/schema.sql`.

| Table | Personal data held | Sensitivity | Purpose |
|---|---|---|---|
| `mothers` | Name, email, bcrypt password hash, phone, WhatsApp number, Telegram chat id, due date, birth date, current week, first pregnancy, dietary restrictions, ethnicity, language, preferences, emergency contact, partner name/phone/opt-in, state/LGA/ward/facility, urban-rural, prior ANC attendance, transport contact, plan, CHW id, family share token, `consent_at`, `consent_version`, `deleted_at` | **Sensitive** (health + identifiers) | Identify her, personalise guidance, route alerts to her CHW, emergency logistics, consent record |
| `chat_messages` | Every message she sends and every reply, with week number | **Sensitive** — free-text symptoms | Conversation continuity and context for replies |
| `journal_entries` | Mood, symptoms, free-text notes | **Sensitive** | Self-tracking; input to the risk screen |
| `vitals` | BP, weight, temperature, fetal heart rate, glucose, notes, whether self- or clinician-entered | **Sensitive** | Red-flag detection and trend review |
| `alerts` | Level, kind, **message text that quotes her own words**, status, reviewer, outcome, referral code, referral/arrival timestamps, facility | **Sensitive** | Human-in-the-loop escalation; time-to-care metric |
| `bump_photos` | Photo bytes (`bytea`), week, note | **Sensitive** (image of her body) | Bump diary |
| `kick_sessions` | Kick counts and timings | Health-related | Fetal movement tracking |
| `weekly_updates` | Personalised weekly content generated for her (subject, development, symptoms, meal plan, HTML) | Health-related, linked to her | Weekly update delivery |
| `push_subscriptions` | Browser push endpoint, `p256dh`, `auth` keys | Identifier / device | Web push notifications |
| `notification_log` | Which reminders were sent to her and when | Behavioural | De-duplicate reminders |
| `misinfo_checks` | Claim text she forwarded, verdict, language, channel | Health-related | Myth-busting; myths dataset |
| `ai_feedback` | Flagged answer text, reason, who flagged it | **Sensitive** if the excerpt contains her words | Clinical quality review |
| `audit_log` | Actor, action, channel, summary, metadata | Metadata about her care | Safety accountability trail |
| `clinicians` | Staff name, email, bcrypt hash | Staff personal data | Portal authentication |
| `wa_onboarding` | Phone number + partial signup data while she is registering | Identifier | Transient signup state |
| `app_settings` | No personal data | — | Feature flags |
| `kb_chunks` (created by `lib/rag.ts`) | No personal data — curated guidance only | — | Retrieval grounding |

---

## 2. Lawful basis and principles

| NDPA principle | How Bumply meets it |
|---|---|
| **Lawful basis** | **Consent.** Before storing a conversation, Bumply sends a ≤60-word plain-language notice in her language (`consentMessage()`, `lib/consent.ts`) and requires an affirmative reply. `recordConsent()` writes `consent_at` and `consent_version`. Where a danger sign is detected, alerting her assigned health worker is additionally supported by **protection of her vital interests**. |
| **Transparency** | The consent notice states what is stored, why, who sees it, and how to erase it. `/privacy` gives the long form. Nothing is collected for an undisclosed purpose. |
| **Purpose limitation** | Data is used to answer her, alert her CHW, remind her of visits, and report aggregate programme results. It is not sold, not rented, and not used for advertising or profiling for commercial purposes. |
| **Minimisation** | No NIN, BVN, government ID or financial data. Location is at state/LGA/ward granularity, not GPS. Optional fields (partner, transport, facility) are exactly that. Chat excerpts stored in alerts are truncated to 160 characters; flag text to 2,000; misinfo claims to 500. |
| **Accuracy** | She can correct her profile in the app; a CHW can correct clinical fields. |
| **Storage limitation** | Retention policy in §4. |
| **Integrity and confidentiality** | Access controls in §3. |
| **Accountability** | `audit_log` plus this documentation set. |

**Consent quality.** Consent is a genuine choice: a mother who does not consent still
receives danger-sign safety replies (the deterministic checker answers unregistered
numbers), so she is never coerced into consenting to get help. Withdrawal is one message
away and uses the same words she would naturally use.

---

## 3. Access control

- **Mothers**: `jose` HS256 JWT in an `httpOnly`, `secure` (production), `SameSite=Lax`
  cookie, 30-day sliding expiry refreshed in `middleware.ts`. Passwords are bcrypt-hashed.
- **Clinicians**: separate `bumply_clinician` cookie, 7-day expiry, role claim verified on
  every read (`lib/clinicianSession.ts`). A CHW's worklist is scoped by `mothers.chw_id`.
- **Admin**: separate admin session (`lib/adminSession.ts`) for settings and aggregate
  insights.
- **Database**: Postgres is **not publicly exposed**. The app reaches it through a REST
  bridge (`{SUPABASE_REST_URL}/pg/query` via Kong) using a service key held **server-side
  only**; the key is never sent to a browser.
- **Webhooks**: WhatsApp and Telegram webhooks require a shared secret
  (`WHATSAPP_WEBHOOK_SECRET`, `TELEGRAM_WEBHOOK_SECRET`); group chats and status broadcasts
  are ignored outright.
- **Transport**: HTTPS/TLS everywhere; WhatsApp and Telegram traffic is encrypted in
  transit by the platforms.

**Known gaps (stated, not hidden).** There is no column-level encryption — chat content is
stored as plaintext in the database and protected by host and network controls.
Role-based access is application-enforced rather than enforced by Postgres RLS.

---

## 4. Retention and erasure

**Policy.** Active while she uses Bumply; inactive accounts erased after **24 months** of
no activity. Aggregate, non-identifying programme statistics are kept indefinitely.
*(Automated retention sweeping is a policy commitment, not yet a scheduled job — planned.)*

**Erasure on request.** Two routes, both immediate:

1. **Chat**: she messages "delete my data", "forget me", "remove my data" or "stop" in any
   of the five languages (`isDeleteRequest()`); Bumply asks her to confirm once
   (`DELETE_CONFIRM_MESSAGE`) and then erases.
2. **Web**: `POST /api/account/delete` with `{"confirm":"DELETE"}`, session-authenticated,
   then the session cookie is destroyed.

Both call `eraseMotherData(id)` (`lib/queries.ts`), which:

- **deletes** `chat_messages`, `journal_entries`, `bump_photos`, `vitals`;
- **de-identifies** `misinfo_checks.mother_id → null` and `audit_log.mother_id → null`, so
  the safety trail survives without pointing at her;
- **tombstones** the `mothers` row: `deleted_at = now()`, name replaced with
  "Deleted user", email replaced with a `@bumply.invalid` value, and phone, WhatsApp
  number, Telegram chat id, partner phone, transport contact and preferences nulled — so
  her number can never be matched to her again by the inbound webhook lookup;
- writes a `data_deleted` audit entry with no mother id attached.

**Erasure gaps identified in this review — remediation required before the pilot.**
Because the `mothers` row is tombstoned rather than deleted, the `ON DELETE CASCADE`
foreign keys never fire, so the following still hold data linked to her id:
`weekly_updates` (personalised content), `kick_sessions`, `push_subscriptions`,
`notification_log`, `alerts` (which quote up to 160 characters of her own message),
`ai_feedback` (which may quote her message and holds `mother_id`), and `wa_onboarding`
(keyed by her phone number if she abandoned signup). The fix is a single extension of
`eraseMotherData()` — delete those rows, redact `alerts.message`, null
`ai_feedback.mother_id`, and clear `wa_onboarding` by phone. This is tracked as a blocking
item, not a nice-to-have.

---

## 5. Third-party processors actually used

| Service | Role | What it receives | Location |
|---|---|---|---|
| **Self-hosted Supabase / Postgres** | Primary data store (controller-operated) | Everything in §1 | Team-controlled infrastructure |
| **NVIDIA NIM** (`integrate.api.nvidia.com`) | Chat generation, embeddings (`nv-embedqa-e5-v5`), photo reading (`llama-3.2-11b-vision-instruct`) | Her **first name**, pregnancy week/stage, her message, a summary of recent journal entries, recent chat turns, retrieved guidance snippets; for photo reading, the image itself | Outside Nigeria (US) |
| **Modal** (`*.modal.run`) | Whisper speech-to-text, SoroTTS speech, HelpMum en↔yo/ha/ig translators, HelpMum MamaBot (deployed for provenance, **not in the reply path**) | Voice-note audio; reply text for speech; text for translation | Outside Nigeria (US), scale-to-zero |
| **Evolution API** (self-hosted, Baileys) | WhatsApp gateway | Full message content in plaintext at the gateway | Team-controlled infrastructure |
| **WhatsApp / Meta** | Message transport | Message content and metadata (phone numbers, timestamps) | Outside Nigeria |
| **Telegram** | Message transport (Bot API) | Message content and metadata; bot chats are **not** end-to-end encrypted | Outside Nigeria |
| **Plunk** | Transactional email | Email address and message body | Outside Nigeria (self-hostable) |
| **BulkSMS Nigeria** | SMS safety net for urgent alerts | Phone number and alert text | Nigeria |
| **Railway** | Application hosting | Runtime and request logs | Outside Nigeria |
| **Web Push (VAPID)** | Browser push delivery | Encrypted payload to the browser vendor's push endpoint | Outside Nigeria |
| **Meilisearch** (self-hosted, optional) | Keyword index of the knowledge base | Curated guidance only — **no personal data** | Team-controlled |
| **OpenStreetMap** (Nominatim / Overpass) | Hospital locator | A place name or coordinates — **no identifier** | Outside Nigeria |

Optional/legacy providers configured but not primary: Resend and Gmail SMTP (email
fallbacks), Hugging Face (knowledge-base translation, no personal data).

---

## 6. Cross-border transfer

Several processors above are outside Nigeria. Bumply's position:

1. **Basis.** Transfer is necessary for the performance of the service the mother has
   asked for (an instant answer, a spoken reply in her language), and she is told at
   consent that her messages are processed to answer her. Where the NDPC has recognised a
   destination as providing adequate protection, that basis is relied on; otherwise the
   transfer rests on her informed consent and contractual necessity.
2. **Minimisation in transit.** Only what is needed to produce an answer is sent to the
   inference provider — no phone number, no email, no address, no NIN.
3. **Known weakness.** Her **first name is currently included in the system prompt** to
   make replies feel human. This is pseudonymous but not anonymous. Planned mitigation:
   substitute a neutral token before the model call and restore the name locally in the
   reply.
4. **No training.** Data is sent for inference only. Bumply does not submit mothers'
   messages for model training, and the fine-tuning pipeline (`modal/finetune.py`) uses the
   **curated public knowledge pack**, never mothers' conversations.
5. **Reducing exposure over time.** The on-device stack (`SmolLM2-135M`, `SmolVLM-256M`,
   `whisper-tiny`, browser speech) and the deterministic danger checker already keep the
   highest-stakes path entirely on the phone. Expanding the share of traffic served
   on-device or by a Nigeria-hosted model is an explicit roadmap goal.

---

## 7. Breach procedure

**Definition.** Any accidental or unlawful destruction, loss, alteration, unauthorised
disclosure of, or access to personal data — including a leaked service key, a compromised
Evolution or Modal endpoint, a misdirected message reaching the wrong mother, or an
exported CSV sent to the wrong recipient.

| Step | Action | Target |
|---|---|---|
| 1. Detect and contain | Rotate the affected credential (`AUTH_SECRET`, `SUPABASE_SERVICE_KEY`, `EVOLUTION_API_KEY`, webhook secrets, `NVIDIA_API_KEY`), revoke sessions, disable the affected feature via admin settings | Immediately |
| 2. Assess | What data, how many mothers, is it sensitive data, is real-world harm plausible (stigma, partner violence, loss of confidentiality about a pregnancy) | Within 24 h |
| 3. Notify the NDPC | Where the breach is likely to result in a risk to the rights and freedoms of data subjects, notify the Commission with the nature, categories, approximate numbers, likely consequences and measures taken | **Within 72 h of becoming aware** |
| 4. Notify mothers | Where risk is high, notify affected mothers directly on their own channel, in their own language, in plain words: what happened, what it means for her, what she should do | Without undue delay |
| 5. Remediate | Fix root cause; add a regression test; record the commit | 14 days |
| 6. Record | Every breach — reportable or not — is entered in an internal breach register with dates, decisions and rationale | Ongoing |

**Accountability.** A named data protection contact is responsible for steps 2–4.
Registration as a *data controller of major importance* and appointment of a formal Data
Protection Officer will be assessed against the NDPC's published thresholds as enrolment
grows; at pilot scale this is monitored, not yet triggered — **planned**.

---

## 8. Data subject rights, and how they are served

| Right | How | Status |
|---|---|---|
| Access | Email the data protection contact; response within 30 days | Manual process |
| Rectification | In-app profile edit, or a CHW correcting clinical fields | Built |
| Erasure | "delete my data" on WhatsApp/Telegram, or `POST /api/account/delete` | Built (see §4 gaps) |
| Withdraw consent | Same erasure flow; withdrawal stops further storage | Built |
| Restriction / objection | Email request; handled manually | Manual process |
| Portability | Export of her own records | **Planned** — the CSV export today serves clinicians, not mothers |
| Complaint | To the project, then to the NDPC | Documented on `/privacy` |
