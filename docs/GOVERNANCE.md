# Clinical Governance — Bumply

*Version 1.0 · July 2026 · owner: Bumply technical lead · review cycle: quarterly*

Bumply is an AI pregnancy and newborn companion for Nigerian mothers, delivered over
WhatsApp, Telegram, the web and an installable Android app. This document states what
clinical content it carries, where that content comes from, what stops a language model
from doing harm, and what happens when something goes wrong.

---

## 1. What Bumply claims — and what it does not

**Claims.** Bumply gives general, plain-language maternal-health guidance; it detects a
defined list of danger signs in a mother's own words and languages; it tells her to get to
care; it alerts the community health worker (CHW) assigned to her; and it records whether
she reached a facility.

**Not claimed.** Bumply is **not a diagnostic device, not a medical device, and not a
triage system that replaces a clinician.** It does not diagnose, does not prescribe, does
not adjust medication, and does not decide who does or does not need care — it always
escalates upward, never downward. It is not a substitute for antenatal care, and it has
not yet undergone a prospective clinical validation study (see §9).

Every urgent output carries a plain disclaimer in the message itself, e.g. *"(This na
safety warning, no be diagnosis.)"* — see `dangerReply()` in `lib/dangerSigns.ts`.

---

## 2. Content provenance

All clinical content lives in version-controlled files. There is no clinician-authored
content that exists only in a database a reviewer cannot inspect.

| Content | File | Source basis |
|---|---|---|
| Danger-sign rules (pregnancy, postpartum, newborn) | `lib/dangerSigns.ts` | WHO ANC danger-sign list, adapted to English, Nigerian Pidgin and Yorùbá/Hausa/Igbo terms |
| ANC visit schedule | `lib/anc.ts` | WHO 2016 ANC model + Nigeria-typical clinic practice |
| Childhood immunization schedule | `lib/immunization.ts` | Nigeria National Programme on Immunization (NPI) / WHO |
| Symptom triage flows | `lib/triage.ts` | WHO / NICE-style antenatal danger-sign thresholds, deterministic |
| Vitals red-flag thresholds | `lib/vitals.ts` | Conservative, information-only thresholds (e.g. BP ≥140/90, temp ≥38 °C) |
| Predictive risk screen (pre-eclampsia, GDM, preterm) | `lib/risk.ts` | Deterministic, explainable scoring; every score lists its drivers |
| Wellbeing screen | `lib/mood.ts` | 10-item screen in the style of the Edinburgh Postnatal Depression Scale, items paraphrased |
| Retrieval knowledge base (RAG) | `scripts/seed-kb.mts` → `kb_chunks` | Each chunk carries a `source` label (`WHO`, `WHO 2016 ANC`, `general guidance`) shown to the model and available for citation |
| Offline knowledge pack (103 curated Q&A) | `public/offline/maternal-qa.json` | Curated, plain-language, WHO/Nigeria-aligned; explicitly marked *"NOT a diagnosis"* in the file header |

The RAG block is injected into the prompt as `VERIFIED REFERENCE (rely on this; don't
contradict it)` (`lib/companion.ts`), and `groundingWithSources()` (`lib/rag.ts`) returns
the source labels so answers can be attributed.

---

## 3. Versioning and sign-off

**Implemented today**

- All content changes are git commits; each is reviewable line by line with its diff.
- The consent notice is version-stamped (`CONSENT_VERSION` in `lib/consent.ts`, currently
  `v1-2026-07`) and the version a mother agreed to is written to
  `mothers.consent_version` with `consent_at`.
- Every RAG chunk carries a `source` label; the offline pack carries a `version` field.
- The chat model is pinned by env (`NVIDIA_MODEL_STRONG`) rather than floating.

**Planned before the first supervised pilot** (stated as planned, not built)

- A named clinical reviewer (a registered Nigerian midwife or obstetrician) signs off the
  danger-sign rule set, the triage flows and the 103-item knowledge pack, recorded in a
  `CONTENT_VERSION` stamp of the form `content-vN-YYYY-MM · reviewed by <name, licence
  no.> · <date>`, held alongside the files it covers.
- Any change to `lib/dangerSigns.ts`, `lib/triage.ts`, `lib/vitals.ts` or the knowledge
  pack requires that reviewer's approval on the pull request before merge.
- Quarterly content review against the current WHO ANC recommendations and Nigeria FMoH
  guidance, logged in this file's changelog.

---

## 4. Guardrail-first architecture

The design principle is simple: **the highest-stakes behaviour must not depend on a
language model being available, correct, or even reachable.**

### Layer 0 — deterministic danger detection (runs before any AI)

`detectDangerSign()` in `lib/dangerSigns.ts` is a pure regex rule engine over 17 rules
covering pregnancy, postpartum and newborn danger signs. It is called **before** any model
call in `app/api/whatsapp/webhook/route.ts` and the Telegram webhook; on a hit, the flow
`continue`s and the model is never invoked. Design properties:

- **Language coverage.** Rules match English, Nigerian Pidgin and distinctive
  Yorùbá/Hausa/Igbo terms (`giri`, `wárápá`, `ẹjẹ`, `jini`, `ọbara`, `iba`, `zazzabi`,
  `ahụ ọkụ`). The file states the rule that native terms are **additive only** — they can
  widen detection but can never create a new false negative.
- **False-positive control.** Rules carry `not:` exclusion lists. The `vaginal bleeding`
  rule excludes `blood pressure`, `bp`, `blood sugar`, `blood tonic/level/test/group`,
  `low blood`, `nose bleed`, `bleeding gums` — added after a bare `\bblood\b` was hijacking
  ordinary conversation about anaemia and blood tests with a frightening urgent reply.
- **Severity is monotone.** When several rules match, `emergency` always beats `urgent`.
- **No lookbehind assertions**, so the same rules run in an old Android WebView on-device.
- **Availability.** The check is pure computation: no network, no API key, no model. If
  NVIDIA, Modal, the database and the internet are all down, a mother who types *"I dey
  see plenty blood"* on a cached offline page still gets the correct instruction.
- **Escalation.** On a hit the webhook sends the urgent reply, sends a spoken version if
  she used voice, and writes an alert (`createAlert`, kind `danger-sign`) that surfaces in
  the CHW portal.
- **Unregistered numbers are still protected.** In the WhatsApp webhook, a danger sign
  from a number that has never signed up is answered *before* onboarding continues.

### Layer 1 — model-output guards (`lib/ai.ts`)

Everything the model produces passes through hard, testable filters:

| Guard | What it stops |
|---|---|
| **Single-model policy** | Only `nvidia/llama-3.3-nemotron-super-49b-v1` is allowed in chat. The 8B model was **banned from chat** (2026-07-16) after producing rambling, role-reversed replies. There is no silent downgrade to a weaker model. |
| `looksReversed()` | The worst failure mode observed: the model speaking *as* the anxious mother and asking **her** for advice ("do you have any advice for me?", "how are you coping?"). Detected by reversal phrasing plus question density (≥4 question marks alone is rejected). A reversed reply is discarded, not sent. |
| `looksBad()` | Junk and scraped-forum artefacts ("1 doctor agreed with this answer", HealthTap/iCliniq text), repeated lines, and low lexical variety. |
| `cleanReply()` | Strips `<think>` reasoning blocks, hallucinated `User:`/`Assistant:` turns, leading role labels, self-referential meta commentary (`(Note: as per the guidelines…)`) and stray wrapping quotes — so a mother never sees the machinery. |
| `enforceChatBrevity()` | Hard ceiling of 3 sentences / 60 words, always ending on a complete sentence — no mid-sentence `max_tokens` truncation, which in a safety message is dangerous. |
| `toChatText()` | Plain text only; WhatsApp and Telegram render `**bold**` literally. |
| `CHAT_STOPS` + `withModelQuirks()` | Cut generation at hallucinated turns; disable Nemotron's "detailed thinking" preamble. |
| **Bounded retries + safe fallback** | Two attempts (35 s, 30 s). If both fail or are rejected, `aiComplete()` returns `""` and the caller sends its own safe, human-written line — the system degrades to a friendly non-answer, never to a wrong answer. |
| **Prompt-level constraints** | The system prompt states *"You are NOT a doctor… Never diagnose or prescribe"*, injects a stage-appropriate warning line (pregnancy vs postpartum vs newborn), and injects the RAG block as authoritative. |
| **Context timeouts** | Every context fetch in `bumplyReply()` is bounded at 8 s, so a hanging database call can never stall her reply (a 74 s reply was observed and fixed). |

### Layer 2 — human in the loop

Alerts (from danger signs, from vitals thresholds, and from the proactive risk watch in
`lib/notify.ts`) land in the CHW/clinician portal. A clinician reviews, contacts the
mother, and **closes the loop** by recording the real-world outcome
(`sought_care | ok | no_response | referred`, `setAlertOutcome`). Referral codes and
arrival confirmation (`setAlertReferral`, `confirmArrivalByCode`) produce the outcome
metric: median hours from danger sign to facility arrival (`timeToCare()`).

### Layer 3 — offline

The `/sos` page, the on-device danger checker, the 103-item knowledge pack and a tiny
on-device model (`SmolLM2-135M`) are service-worker cached, so the safety layer survives
no signal, no data plan and no cloud.

---

## 5. Audit trail

`preg_companion.audit_log` records `(mother_id, actor, action, channel, summary, meta,
created_at)`. Writes go through `logAudit()` (`lib/queries.ts`), which is deliberately
**fire-and-forget**: an audit failure logs to stderr and can never break a mother's
conversation. Actions recorded today include `consent`, `data_deleted` and
`ai_answer_flagged`; the intended full set is `ai_reply`, `danger_detected`,
`alert_outcome`, `consent`, `data_deleted`, `ai_answer_flagged`.

`recentAudit(limit)` exists as the read query. An admin-facing audit view is **planned**;
today the log is queried directly.

Erasure and the audit trail are reconciled honestly: `eraseMotherData()` sets
`audit_log.mother_id = null` for that mother, so the safety record survives in
de-identified form while nothing in it can point back to her.

---

## 6. "Flag this answer" — the clinical quality loop

`POST /api/feedback` accepts `{ message, reason }` from either a signed-in mother or an
authenticated clinician, and writes to `preg_companion.ai_feedback` via `flagAiAnswer()`
with `flagged_by` set to `mother` or `clinician:<name>`, so mother-reported and
clinician-reported problems can be separated in review. Each flag also writes an
`ai_answer_flagged` audit row.

**Intended operating rhythm** (process, planned): flags are triaged weekly; any flag
alleging unsafe advice is treated as a **potential adverse event** and enters §7 the same
day. Fixes are made in this order — (1) add or widen a deterministic rule, (2) add or
correct a knowledge-pack / RAG item, (3) tighten the prompt or an output guard. Fixing a
safety problem by "prompting harder" alone is not accepted where a deterministic rule is
possible.

---

## 7. Adverse-event procedure

**Definition.** Any event where Bumply's output plausibly contributed to a delay in care,
inappropriate care, or harm to a mother or baby — including a **missed danger sign** (a
false negative), unsafe advice, an alert that never reached a CHW, or a harmful
mistranslation.

| Step | Action | Owner | Target |
|---|---|---|---|
| 1. Report | Any channel: a `POST /api/feedback` flag, a CHW report, a mother's message, or a partner organisation | Anyone | Immediate |
| 2. Acknowledge & make safe | Confirm the mother's current clinical status; if she is still at risk, escalate to her CHW/facility now. If a systemic fault is suspected, disable the affected feature via the admin settings kill-switches (`chat_enabled`, etc.) | Technical lead + clinical reviewer | 24 h |
| 3. Preserve evidence | Freeze the relevant `chat_messages`, `alerts`, `audit_log` and `ai_feedback` rows; record the model id and content version in force | Technical lead | 24 h |
| 4. Classify | Severity 1 (harm or near-miss with clinical consequence) / 2 (unsafe output, no harm) / 3 (quality defect) | Clinical reviewer | 72 h |
| 5. Root cause | Which layer failed: rule set, retrieval, model output, guard, delivery, or human follow-up? | Technical lead | 7 days |
| 6. Corrective action | Deterministic rule first; add a regression case to `scripts/unit.mts` so the exact phrasing can never regress | Technical lead | 14 days |
| 7. Report | Severity 1 events are reported to the implementing partner, the supervising facility and the funder; personal data is minimised in the report | Project lead | 14 days |
| 8. Close | Record cause, fix, commit hash and verification in the governance changelog | Clinical reviewer | 30 days |

A Severity 1 event pauses new mother enrolment until step 6 is verified.

---

## 8. Roles

| Role | Responsibility | Status |
|---|---|---|
| Technical lead | Architecture, guardrails, incident response, audit integrity | Filled |
| Clinical reviewer (midwife/obstetrician) | Content sign-off, adverse-event classification, quarterly review | **Planned — to be appointed before the supervised pilot** |
| CHW supervisor (partner facility) | Alert response times, close-the-loop discipline | Filled at deployment |
| Data protection contact | NDPA requests, breach handling (see `DATA-PROTECTION.md`) | Filled |

---

## 9. Limitations and known gaps

Stated plainly, because a reviewer will find them anyway:

1. **No prospective clinical validation yet.** Danger-sign sensitivity and specificity have
   not been measured against clinician adjudication on real messages. Building that
   labelled multilingual benchmark is a funded work item (see `OPEN-SOURCE.md`).
2. **Rule-based detection misses novel phrasing.** A mother describing bleeding in a way no
   rule anticipates is not detected. Mitigation: rules are additive and cheap to extend;
   every miss becomes a regression test. **Severe headache is currently not a standalone
   rule** (only vision changes are) — a known gap being closed.
3. **The LLM can still be wrong** in the non-danger conversational path. Guards constrain
   form (length, role, tone, plain text) more strongly than they constrain factual content;
   grounding reduces but does not eliminate error.
4. **Translation is unvalidated.** Yorùbá/Hausa/Igbo replies pass through HelpMum's M2M100
   translators; output quality has not been formally assessed by native-speaking
   clinicians. Sanity checks exist (`lib/companion.ts` keeps the English reply if the
   translation looks malformed), but they are heuristics.
5. **Voice adds a transcription error path.** Whisper mis-transcription can change meaning;
   the deterministic checker then runs on the transcript, not on her actual words.
6. **Delivery is not guaranteed.** The WhatsApp gateway is a self-hosted Evolution
   (Baileys) instance on an unofficial connection and can be disconnected or banned;
   Telegram, web push, email and SMS are the fallbacks. An alert that is not delivered is a
   safety event, not merely an outage.
7. **Human response is not 24/7.** Bumply answers instantly; the CHW who receives the alert
   may not. Bumply therefore always instructs the mother to go to a facility herself rather
   than to wait for a call back.
8. **The risk engine is a screen, not a predictor.** `lib/risk.ts` is a transparent scoring
   heuristic over self-reported vitals and journal entries; it has no validated positive
   predictive value and is presented to mothers as "a gentle check-in", never as a finding.
9. **Photo reading is assistive only.** ANC-card and test-result reading uses a general
   vision model; it can misread handwriting and numbers, and the output always ends by
   pointing back to a health worker.
