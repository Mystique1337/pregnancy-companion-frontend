# Open Source and Digital Public Goods

*Version 1.0 · July 2026*

Bumply's most valuable assets are not the app — they are the **multilingual safety layer,
the curated maternal knowledge, and the on-device stack** that make a "midwife in her
pocket" work on a ₦45k Android with no signal. Those are exactly the assets that should not
be locked inside one project. This document states what we will release, under what
licence, and why that matters to a funder such as the **UNICEF Innovation Fund**, which
funds open-source solutions and expects outputs that meet the **Digital Public Goods
Standard**.

*Current status: the repository is not yet publicly licensed. Everything below is stated as
a commitment and a plan, not as something already published.*

---

## 1. What we will release

### 1.1 The multilingual maternal danger-sign benchmark — *the flagship public good*

**What it is.** A labelled evaluation set of real-world phrasings of maternal, postpartum
and newborn danger signs across **English, Nigerian Pidgin, Yorùbá, Hausa and Igbo**, with
a clinician-adjudicated gold label per item, plus hard negatives — the phrases that *look*
dangerous but are not (*"blood tonic"*, *"low blood"*, *"blood pressure"*, *"bleeding
gums"*, *"the pain will not stop"*), and the deterministic reference detector that is
scored against it.

**Why it matters.** There is no public benchmark for detecting obstetric danger signs in
Nigerian languages and code-switched Pidgin. Without one, every team — and every LLM
vendor claiming maternal-health capability — is guessing. A shared benchmark makes safety
claims falsifiable and lets a ministry ask a vendor for a number instead of a demo.

**Its origin is a real engineering artefact, not a paper exercise.** The exclusion rules in
`lib/dangerSigns.ts` exist because a naive `blood` match was hijacking ordinary
conversations about anaemia and blood tests with frightening urgent replies. Those
false-positive traps are precisely the hard cases a benchmark needs.

**Contents:** the rule engine (~17 rules over pregnancy, postpartum and newborn signs), the
labelled multilingual corpus, hard negatives, a scoring harness reporting per-sign and
per-language sensitivity/specificity, and a baseline comparison of rules vs an LLM judge.

**Licence:** code **Apache-2.0**; corpus and labels **CC BY 4.0**. No mother's real message
is ever released — the corpus is authored and validated by native speakers and clinicians,
and anything derived from real traffic is paraphrased and reviewed before inclusion (see
`DATA-PROTECTION.md`).

### 1.2 The curated maternal knowledge pack

**What it is.** `public/offline/maternal-qa.json` — 103 vetted, plain-language questions and
answers written for a low-literacy Nigerian mother, aligned to WHO and Nigeria FMoH
guidance, with the RAG chunk set from `scripts/seed-kb.mts` that carries an explicit
`source` label per item.

**Why it matters.** Most maternal content available to a Nigerian mother online is
US/UK-centric, English-only, and written at a reading level she cannot use. This pack is
small enough to cache on a phone, grounded enough to constrain a language model, and
usable directly as training data — `modal/finetune.py` already LoRA-fine-tunes a small
model on it.

**Release plan:** publish with per-item source attribution, reviewer, and a version stamp;
translate into all five languages with native-speaker review; accept community
contributions under a clinical-review gate (`GOVERNANCE.md` §3).

**Licence:** **CC BY 4.0** — deliberately permissive so a state, an NGO or a competing app
can embed it without negotiating with us.

### 1.3 The on-device offline stack

**What it is.** The working "no signal, no bill" path: the service-worker-cached `/sos`
page, the on-device danger checker, `transformers.js` wiring for `SmolLM2-135M-Instruct`
(chat) and `SmolVLM-256M-Instruct` (reading an ANC card or medicine packet), `whisper-tiny`
plus browser speech synthesis for voice, retrieval over the curated pack, and the LoRA
fine-tune pipeline that distils the pack into the small model.

**Why it matters.** The reference implementations of on-device AI assume a modern phone and
a developer's laptop. This one is built for a ₦45k Android on patchy 3G, and it proves the
useful claim: **the highest-stakes features never go dark.** Any team building offline-first
health tools in a low-connectivity setting can lift it whole.

**Licence:** **MIT** (or Apache-2.0 where patent grant is preferred), so it can be
embedded in both public-sector and commercial deployments.

### 1.4 Also released

- **This governance and data-protection documentation set** — `GOVERNANCE.md`,
  `DATA-PROTECTION.md`, `WHO-SMART-ALIGNMENT.md` — as reusable templates under **CC BY
  4.0**. A small team building a health chatbot in Nigeria should not have to work out the
  NDPA mapping from scratch.
- **The consent module** (`lib/consent.ts`): version-stamped, ≤60-word consent in five
  languages plus the "delete my data" recognisers. Small, copyable, and the part teams most
  often skip. **MIT**.

### 1.5 What we do not release

Mothers' data, in any form — no messages, no journals, no photos, no de-identified chat
corpus. Nothing derived from real conversations is published without paraphrase, clinical
review and an explicit privacy assessment. Operational credentials, gateway configuration
and CHW rosters likewise stay private.

---

## 2. Digital Public Goods Standard alignment

| DPG Standard requirement | Bumply position |
|---|---|
| Relevance to the SDGs | SDG 3.1 — reducing the maternal mortality ratio; SDG 3.2 — newborn survival |
| Use of an approved open licence | Apache-2.0 / MIT for code, CC BY 4.0 for content and data |
| Clear ownership | Held by the project team; contributor terms published with the repository |
| Platform independence | Web standards, Postgres, OpenAI-compatible inference — provider and model swappable by environment variable; no proprietary runtime |
| Documentation | This documentation set, plus `README.md`, `DEPLOY.md`, `DEMO-TESTING.md`, `ANDROID.md` |
| Mechanism for extracting data | CSV export exists for programme data; **mother-facing data export is planned** |
| Adherence to privacy and applicable laws | NDPA 2023 mapping in `DATA-PROTECTION.md`; consent versioning and erasure implemented |
| Standards and best practices | WHO SMART Guidelines / ANC DAK alignment documented, with gaps stated in `WHO-SMART-ALIGNMENT.md` |
| Do-no-harm by design | Guardrail-first architecture, adverse-event procedure, explicit "not a diagnostic device" claim boundary |

**Planned:** formal submission to the Digital Public Goods Alliance registry once the
licences are applied and the benchmark is published.

---

## 3. Why this matters to a funder like the UNICEF Innovation Fund

1. **The Fund invests in open-source public goods, not in features.** A benchmark, a
   knowledge pack and an offline stack outlive the grant, the team, and even the app.
2. **It de-risks everyone else's work.** Any Nigerian maternal-health team that adopts the
   benchmark starts with a measurable safety floor instead of an untested prompt.
3. **It is verifiable.** Reviewers can clone the repository, run the danger-sign harness,
   read the rules, and check the claims themselves — no demo required.
4. **It makes procurement honest.** A state ministry can require a published sensitivity
   score on a public benchmark before buying any maternal chatbot, ours included.
5. **It builds on open work already used in production.** HelpMum's MamaBot and its
   English↔Yorùbá/Hausa/Igbo translators are deployed in this stack; releasing our layer
   returns value to that ecosystem rather than extracting from it.

---

## 4. Release plan

| Milestone | Output | Timing |
|---|---|---|
| 1 | Apply licences (`LICENSE`, `NOTICE`, contributor terms) and make the repository public | Month 1 |
| 2 | Publish the knowledge pack with per-item sources, reviewer and version stamp | Month 2 |
| 3 | Publish the on-device stack as a standalone, documented example | Month 3 |
| 4 | Publish v0.1 of the danger-sign benchmark: corpus, hard negatives, scoring harness, baseline results | Month 6 |
| 5 | Clinician-adjudicated v1.0 of the benchmark across all five languages, with a written evaluation report | Month 12 |
| 6 | Submit to the Digital Public Goods Alliance registry | Month 12 |
