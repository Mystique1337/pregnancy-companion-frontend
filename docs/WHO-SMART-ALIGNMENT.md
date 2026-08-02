# WHO SMART Guidelines Alignment — Antenatal Care DAK

*Version 1.0 · July 2026*

WHO's SMART Guidelines describe five layers, from narrative guidance (L1) through the
**Digital Adaptation Kit** (L2 — personas, user scenarios, business processes, core data
elements, decision-support logic, indicators, requirements), to machine-readable FHIR
artefacts (L3) and executable/validated implementations (L4–L5).

**Where Bumply sits: L1→L2 aligned, L3 not implemented.** Bumply's clinical content and
decision logic follow the WHO ANC recommendations and the structure of the ANC DAK, and
its data model captures a meaningful subset of the DAK's core data elements. It does
**not** yet publish FHIR/CQL artefacts, does not use coded terminology (ICD-11, LOINC,
SNOMED CT), and has not been through a WHO or FMoH conformance process. This document maps
what exists against what the DAK expects, and names the gaps.

---

## 1. Personas and scenarios

| DAK persona | Bumply equivalent | Notes |
|---|---|---|
| Pregnant woman / client | Primary user — WhatsApp, Telegram, web, offline PWA | Explicitly designed for low literacy: voice in/out, 5 languages, no app install |
| Community health worker | CHW/clinician portal: enrol, worklist, alert queue, close-the-loop, CSV export | `chwWorklist()` prioritises by open/urgent alerts and days silent |
| ANC facility staff / midwife | Same portal; referral-code arrival confirmation | `confirmArrivalByCode()` |
| Partner / family | Read-only weekly share link; optional partner channel (`partner_phone`, `partner_opt_in`) | Addresses the household decision-maker, a real barrier in Delay 1 |
| Health programme manager | Aggregate reach report and time-to-care metric | `reachReport()`, `timeToCare()` |

**Deliberate extension beyond the DAK:** Bumply models the *Three Delays* directly —
Delay 1 (deciding to seek care) via danger-sign detection in her own words and the partner
channel; Delay 2 (reaching care) via a transport plan captured **before** the emergency
(`transport_name/phone/note`); Delay 3 (receiving care) via referral codes and arrival
confirmation.

---

## 2. ANC contact schedule (8 contacts)

WHO's 2016 ANC model replaces four focused visits with **eight contacts**: one in the first
trimester, two in the second, five in the third.

| WHO contact | Recommended timing | Bumply `ANC_SCHEDULE` (`lib/anc.ts`) |
|---|---|---|
| 1 | up to 12 weeks | wk 8 "Book your first antenatal visit" + wk 12 "Dating scan & booking bloods" |
| 2 | 20 weeks | wk 20 "Anomaly (detailed) scan" *(plus an extra wk 16 check-up)* |
| 3 | 26 weeks | **not represented** — Bumply has wk 24 and wk 28 |
| 4 | 30 weeks | **not represented** — Bumply has wk 28 and wk 32 |
| 5 | 34 weeks | **not represented** — Bumply has wk 32 and wk 36 |
| 6 | 36 weeks | wk 36 "Position check & birth plan" |
| 7 | 38 weeks | wk 38 "Antenatal check-up" |
| 8 | 40 weeks | wk 40 "Due-date check" |

**Honest assessment.** Bumply schedules **ten** reminders, so it exceeds WHO's minimum
count, but it follows a Nigeria-typical clinic rhythm (8/12/16/20/24/28/32/36/38/40) rather
than the WHO contact numbering — the 26/30/34-week contacts are absent and 16/24 are extra.
The contacts are also **not labelled** with their WHO contact number, so a programme
manager cannot report "ANC contact 4 completed" from Bumply data.

**Planned fix (small, concrete):** add a `whoContact` field to each `ANCItem`, realign to
8/12/20/26/30/34/36/38/40, and record attendance per contact so ANC1-in-first-trimester and
ANC8 coverage become reportable indicators.

---

## 3. Danger signs ("quick check")

The DAK front-loads a quick check for danger signs at every contact. Bumply runs the
equivalent check on **every inbound message**, not only at contacts —
`detectDangerSign()` in `lib/dangerSigns.ts`, deterministic, before any AI.

| WHO ANC danger sign | Bumply rule | Status |
|---|---|---|
| Vaginal bleeding | `heavy bleeding` (emergency), `vaginal bleeding` (urgent) | ✅ with false-positive exclusions (BP, blood tonic, anaemia, bleeding gums) |
| Convulsions / fits | `fits/convulsions` (emergency) | ✅ incl. Yorùbá *wárápá*, Hausa *farfadiya*, Igbo terms |
| Severe headache with visual disturbance | `vision changes (pre-eclampsia)` | ⚠️ **partial — headache alone is not a rule.** Named gap; being closed |
| Fever, or too weak to get out of bed | `high fever` (incl. *ibà*, *zazzabi*, *ahụ ọkụ*) | ⚠️ partial — "too weak to stand" is not detected |
| Severe abdominal pain | `severe abdominal pain` | ✅ |
| Fast or difficult breathing | `difficulty breathing / chest pain` (emergency) | ✅ |
| Reduced fetal movement | `baby not moving` | ✅ |
| Waters breaking before 37 weeks | `waters broken` | ⚠️ detected, but **not gestational-age aware** — the rule does not check her week |
| Sudden swelling of face/hands | `sudden swelling (face/hands)` | ✅ |
| Fainting / collapse | `fainting / collapse` | ✅ (beyond the core WHO list) |
| Postpartum: foul-smelling discharge, mastitis | 2 rules | ✅ |
| Newborn: not breathing / fast breathing, cold or floppy, not feeding, jaundice, cord infection, fever | 6 rules | ✅ — aligned to WHO/IMNCI newborn danger signs |
| Severe pallor / anaemia, reduced urine output, labour signs before 37 weeks | — | ❌ **not implemented** |

Detection is multilingual by design and additive by rule: native-language terms can only
widen detection, never narrow it.

---

## 4. Counselling topics

| DAK counselling area | In Bumply | Where |
|---|---|---|
| Nutrition and diet | ✅ Nigeria-specific (beans, moimoi, ugu, ewedu, pap) | knowledge pack + RAG |
| Iron and folic acid | ✅ folic acid 400–600 mcg, iron-rich foods, absorption advice | RAG (`source: WHO`) |
| Anaemia | ✅ | RAG |
| Physical activity | ✅ | RAG |
| Tobacco, alcohol, substances | ✅ "avoid alcohol and smoking completely" | knowledge pack |
| Danger signs | ✅ core of the product | `lib/dangerSigns.ts`, `/sos` |
| Birth preparedness / complication readiness | ✅ hospital bag, birth plan, **transport plan captured in the data model** | RAG + `mothers.transport_*` |
| Breastfeeding | ✅ early initiation, exclusive for 6 months | RAG (`source: WHO`) |
| Malaria prevention | ⚠️ partial — treated bed net and prompt fever testing only | RAG |
| **IPTp-SP (intermittent preventive treatment)** | ❌ **gap** — no dose schedule or reminders | — |
| **Calcium supplementation** (high-BP-risk populations) | ❌ gap | — |
| **Deworming** | ❌ gap | — |
| **HIV / syphilis testing, PMTCT** | ⚠️ mentioned only inside the wk-12 "booking bloods" text | `lib/anc.ts` |
| Tetanus-toxoid / Tdap vaccination | ✅ | RAG + ANC schedule |
| Mental health | ✅ counselling content **plus** a 10-item EPDS-style screen | `lib/mood.ts` |
| Postpartum family planning | ❌ gap | — |
| Childhood immunization (post-ANC continuity) | ✅ full Nigeria NPI schedule with due-date reminders | `lib/immunization.ts` |

For a malaria-endemic setting, **IPTp is the most consequential counselling gap** and is
the first content item to add.

---

## 5. Core data elements

| DAK data element group | Bumply field | Status |
|---|---|---|
| Client identifiers, contact details | `mothers.full_name`, `phone`, `whatsapp_number`, `telegram_chat_id`, `email` | ✅ |
| Preferred language | `mothers.language` (en/pcm/yo/ha/ig) | ✅ |
| Location / catchment | `state`, `lga`, `ward`, `facility_name`, `residence` | ✅ |
| Gestational age / EDD | `current_week`, `due_date`, computed from either | ✅ |
| **LMP (last menstrual period)** | — | ❌ gap; GA is derived from due date or self-reported weeks |
| **Gravidity / parity** | `first_pregnancy` (boolean only) | ⚠️ partial |
| **Obstetric history** (previous caesarean, stillbirth, pre-eclampsia) | — | ❌ gap — and it is the strongest predictor set the risk engine is missing |
| Blood pressure | `vitals.kind='bp'` (systolic/diastolic) | ✅ |
| Weight | `vitals.kind='weight'` | ✅ |
| Temperature | `vitals.kind='temp'` | ✅ |
| Fetal heart rate | `vitals.kind='fhr'` | ✅ |
| Blood glucose | `vitals.kind='glucose'` | ✅ |
| **Fundal height, fetal presentation, urine dipstick (protein)** | — | ❌ gap |
| **Laboratory results** (Hb/PCV, blood group, HIV, syphilis, hepatitis) | — | ❌ gap — ANC-card photos are read to her but **not parsed into structured fields** |
| Danger signs present | `alerts` rows with `kind='danger-sign'` and the detected sign | ✅ |
| **Supplement / medication adherence** (IFA, calcium, IPTp doses) | — | ❌ gap |
| Immunization given (mother: TT/Tdap) | — | ❌ gap (child schedule ✅) |
| ANC contact attendance | `anc_attended` (boolean, "before Bumply") + reminder log | ⚠️ partial — no per-contact attendance record |
| Referral and outcome | `alerts.referral_code`, `referred_at`, `arrived_at`, `facility_name`, `outcome` | ✅ (stronger than the DAK minimum) |
| Birth outcome | `mothers.birth_date` | ⚠️ partial — no mode of delivery, birth weight or newborn status |
| Consent | `consent_at`, `consent_version` | ✅ |

---

## 6. Decision-support logic and indicators

**Decision support implemented** — all deterministic and inspectable:

- Danger-sign detection → urgent instruction + CHW alert (`lib/dangerSigns.ts`).
- Symptom triage flows with four outcome levels (`lib/triage.ts`).
- Vitals thresholds → alert (`lib/vitals.ts`).
- Explainable risk screen for pre-eclampsia, gestational diabetes and preterm labour, with
  the driving factors listed alongside each score (`lib/risk.ts`).
- EPDS-style wellbeing screen with a self-harm escalation path (`lib/mood.ts`).
- ANC and immunization schedule reminders keyed to gestational age / infant age.

**Indicators computed:** mothers reached, rural share, share new to ANC, language and state
distribution, transport plan coverage, partner-channel coverage, consent coverage
(`reachReport()`); referrals issued, arrivals confirmed, arrival rate, **median hours from
danger sign to facility arrival** (`timeToCare()`); alert outcomes; myth frequencies.

**Indicator gaps:** no ANC1-before-12-weeks coverage, no ANC4/ANC8 coverage, no IFA or IPTp
coverage, no facility identifiers mapped to the national HMIS. Export is CSV; **DHIS2
integration is planned, not built.**

---

## 7. Summary for a reviewer

**Strong alignment:** danger-sign quick check (multilingual, deterministic, ahead of the
model, and running continuously rather than only at contacts), CHW human-in-the-loop
workflow, referral and time-to-care measurement, newborn danger signs, Nigeria NPI
immunization continuity, consent and erasure.

**Honest gaps, in priority order:** (1) IPTp counselling and adherence; (2) obstetric
history and LMP; (3) structured laboratory and urine-protein results; (4) WHO contact
numbering and per-contact attendance; (5) severe-headache and gestational-age-aware preterm
rules; (6) coded terminology and FHIR/L3 artefacts; (7) DHIS2/HMIS reporting.

None of these gaps require re-architecting: items 1–5 are content and schema additions on
an existing, working data model, and items 6–7 are integration work that a funded pilot
with a state primary healthcare board would justify.
