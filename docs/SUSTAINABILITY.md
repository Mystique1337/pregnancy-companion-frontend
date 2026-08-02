# Sustainability — Life After the Grant

*Version 1.0 · July 2026*

**The commitment: Bumply is free forever for mothers.** Every safety feature — danger-sign
detection, the urgent reply, the CHW alert, voice, offline mode, ANC and immunization
reminders — costs a Nigerian mother nothing, on any channel, permanently. A woman who
cannot afford ₦500 is exactly the woman the product exists for.

**The business: the people who benefit from her being safe pay.** States, NGOs, facilities
and HMOs buy the *health-worker and programme layer* — the worklist, alert queue,
close-the-loop workflow, referral tracking, coverage and time-to-care reporting, and the
CSV/HMIS export that turns care into evidence they can report on. That layer already
exists in the product.

---

## 1. Why the unit economics work

Most digital-health projects die when the grant ends because their marginal cost per user
is high. Bumply's is close to zero — by construction, not by luck.

| Design choice | Cost effect |
|---|---|
| **Deterministic danger detection** (`lib/dangerSigns.ts`) | The highest-value feature in the product is regex over her message. **₦0 per message, forever**, and it works with no network. |
| **Curated 103-item knowledge pack** (`public/offline/maternal-qa.json`) | Common questions are answered from a cached on-device file with no model call at all. |
| **On-device models** (`SmolLM2-135M`, `SmolVLM-256M`, `whisper-tiny`, browser TTS/ASR) | Chat, photo reading and voice can run in the phone's browser. Zero marginal cost, zero data cost, works offline. |
| **Free NVIDIA NIM developer tier** | Chat, embeddings and photo reading currently cost **₦0 in inference** at pilot volume. |
| **Scale-to-zero GPUs on Modal** | Voice and translation bill per second of use. An always-on A10G is roughly US$700–800/month; scale-to-zero at pilot volume is single-digit dollars. |
| **WhatsApp instead of an app install** | No app-store acquisition cost, no 40 MB download on a metered ₦-per-MB plan, no storage on a ₦45k phone. The install path exists (PWA/TWA) but is optional, not a barrier. |
| **Self-hosted Evolution WhatsApp gateway** | No per-conversation gateway fee (see the risk in §4). |
| **One self-hosted Postgres** | Chat, vitals, alerts, RAG vectors and photos all live in one instance the team runs. |

**Illustrative marginal cost per active mother per month** *(assumptions, not measured
production figures; ₦1,500 = US$1)*

| Item | Assumption | Cost |
|---|---|---|
| Chat inference | ~40 replies × ~1.3k tokens, blended US$0.50/M tokens | ~US$0.03 |
| Voice (ASR + TTS) | ~8 voice turns × ~7 GPU-seconds on scale-to-zero | ~US$0.02 |
| SMS safety net | ~0.2 urgent SMS at ₦4 | ~₦1 |
| WhatsApp/Telegram transport | self-hosted gateway | ~₦0 |
| **Total** | | **≈ US$0.05 ≈ ₦75 per mother per month** |

Fixed infrastructure (app hosting, database, gateway) is roughly **US$100–150/month** at
pilot scale and grows slowly. At 30,000 active mothers the illustrative all-in run rate is
therefore on the order of **₦2.5–3.5M per month**, or **≈ ₦1,000 per mother per year** —
the level at which a state programme, an NGO or an HMO can justify it against the cost of
a single averted obstetric emergency.

---

## 2. Who pays, and for what

| Buyer | What they buy | Illustrative price |
|---|---|---|
| **State Primary Health Care Development Agency** | CHW seats + LGA-wide coverage, time-to-care and ANC coverage reporting, HMIS export | ₦2,000 per CHW per month, or ₦350k per LGA per year |
| **NGO / implementing partner** | Programme licence for an enrolled cohort, with M&E dashboards and CSV export mapped to their logframe | ₦400–600 per enrolled mother per year |
| **Private facility / hospital group** | Branded ANC follow-up, danger-sign monitoring between visits, no-show reduction | ₦150k–400k per facility per year |
| **HMO / insurer** | Maternal care management for covered members — the clearest ROI, since one avoided emergency caesarean or ICU admission pays for thousands of member-months | ₦200 per member per month |
| **Mothers** | Everything that keeps them safe | **₦0, permanently** |

*Note on the current code:* a consumer `free`/`premium` plan and a pricing page exist in
the repository from the hackathon build, and WhatsApp chat can be gated behind premium by
an environment flag. **Under this model that gate stays off and the consumer premium tier
is not part of the revenue plan** — charging the mother for the companion contradicts the
reason the product exists.

---

## 3. Three-year scenario *(planning scenario, not a forecast)*

| | Year 1 — supervised pilot | Year 2 — first paid deployments | Year 3 — programme scale |
|---|---|---|---|
| Geography | 1 state, 3 LGAs | 3 states | 6 states + 1 HMO |
| Mothers reached | 5,000 | 30,000 | 120,000 |
| CHW seats | 100 | 600 | 2,000 |
| Funding | Grant (100%) | Grant ~60% / earned ~40% | Grant ~25% / earned ~75% |
| Earned revenue | ₦0 | ~₦35M (1 state contract + 1 NGO cohort) | ~₦150M (4 state/LGA contracts, 2 NGO cohorts, 1 HMO pilot) |
| Direct delivery cost | ~₦6M | ~₦35M | ~₦130M |
| Team | 3 FTE + clinical reviewer (part-time) | 6 FTE | 12 FTE + state field officers |
| Milestone that unlocks the next year | Published danger-sign benchmark + measured median time-to-care | One renewed state contract | Positive contribution margin on the CHW layer |

The point of the table is not the precision of the naira figures — it is the shape:
**delivery cost scales roughly linearly and shallowly, because the expensive part of the
product is free or on-device.** Bumply does not need hypergrowth to survive; it needs two
or three renewing institutional contracts.

---

## 4. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| **WhatsApp bans the unofficial (Baileys) gateway number** | High over time | Anti-ban settings already applied (reject calls, ignore groups, no always-online, humanised send). Telegram is at full feature parity today and web/PWA is a third channel; SMS is the urgent safety net. Migration path to the official WhatsApp Cloud API via a BSP is costed and understood — it changes unit economics, not the product. |
| **Free NVIDIA inference tier is withdrawn or rate-limited** | Medium | The client is a plain OpenAI-compatible client: provider, base URL, key and model are all environment variables, so switching providers is a config change. The on-device model and the curated pack already absorb basic queries; an open-weights model can be self-hosted on Modal at scale-to-zero. |
| **Government procurement is slow and political** | High | NGO and HMO channels run in parallel and do not depend on state budget cycles. Fixed cost is low enough that the service survives a year with zero revenue. |
| **CHW non-adoption / alert fatigue** | Medium | The worklist prioritises by urgent alerts and days-silent rather than showing everything; close-the-loop outcome capture is the supervisor's accountability metric; the paid layer is sold *with* a supervisor, not to lone CHWs. |
| **FX volatility (USD infrastructure vs NGN revenue)** | High | Most cost is usage-based and scale-to-zero, so exposure is proportional rather than fixed; contracts are priced in NGN with an annual FX review; each function moved on-device permanently removes FX exposure. |
| **A clinical safety incident** | Low but severe | Guardrail-first architecture, adverse-event procedure and content sign-off in `GOVERNANCE.md`; enrolment pauses on a Severity 1 event; professional indemnity cover is planned before the supervised pilot. |
| **Data-protection failure or breach** | Low | NDPA mapping, consent versioning, erasure flows and a 72-hour breach procedure in `DATA-PROTECTION.md`. |
| **Key-person dependency** | Medium | The public-goods releases in `OPEN-SOURCE.md` mean the highest-value assets survive the team; the repository is documented for handover. |
| **Impact cannot be evidenced, so nobody renews** | Medium | Time-to-care (median hours from danger sign to facility arrival) is instrumented in the product itself, not bolted on for reporting. |

---

## 5. What "sustainable" means here, concretely

1. **Mothers are never a revenue line.** Free, permanently, on every channel.
2. **The marginal cost of one more mother is under ₦100/month** — and falls as more of the
   stack runs on her phone.
3. **The product measures its own outcome.** Median time from danger sign to facility
   arrival is the metric a state, an NGO and an HMO all want, and it is computed from
   operational data rather than a survey.
4. **No single vendor is load-bearing.** Model provider, channel, voice service and email
   provider are each swappable by environment variable, and the safety core depends on none
   of them.
