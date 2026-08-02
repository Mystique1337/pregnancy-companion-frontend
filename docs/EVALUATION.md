# Evaluating the Bumply danger-sign detector

Bumply's safety core is `detectDangerSign()` in [`lib/dangerSigns.ts`](../lib/dangerSigns.ts). It reads
the mother's own words — English, Nigerian Pidgin, Yoruba, Hausa, Igbo — **before** any AI model runs,
and decides whether the message contains an obstetric or newborn danger sign. If it does, the mother
gets a deterministic "go to the clinic / go to hospital now" reply and her health worker is alerted.
Nothing about that decision is left to a language model.

A safety claim like that has to be measured, not asserted. This directory holds the harness that
measures it.

| File | Purpose |
| --- | --- |
| [`data/danger-benchmark.jsonl`](../data/danger-benchmark.jsonl) | 258 labelled messages — the benchmark |
| [`scripts/eval-danger.mts`](../scripts/eval-danger.mts) | The harness: runs the detector, scores it, gates CI |
| [`eval-danger-report.md`](./eval-danger-report.md) | Full generated report (regenerated on every run) |

---

## Running it

```bash
npm run eval:danger              # or: npx tsx scripts/eval-danger.mts
```

Options:

```bash
npx tsx scripts/eval-danger.mts --fail-under-sens=95   # tighten the CI gate (default 90)
npx tsx scripts/eval-danger.mts --max-failures=200     # print every failing case, not just 40
npx tsx scripts/eval-danger.mts --data=path.jsonl --out=path.md
```

The run prints the confusion matrix, headline metrics, per-language and per-category tables and every
failing message; writes the same content to `docs/eval-danger-report.md`; and ends with a single
machine-readable line so CI can parse it without scraping:

```
RESULT_JSON: {"total":258,"sensitivity":100,"specificity":95.1, ... ,"pass":true}
```

**Exit code:** `0` if sensitivity ≥ `--fail-under-sens` (default 90%), `1` otherwise. Zero external
dependencies — it imports the detector directly and uses only `node:fs`.

---

## The benchmark

258 messages written to look like what actually arrives on WhatsApp from a low-bandwidth,
low-literacy user: lowercase, no punctuation, typos, abbreviations, code-switching mid-sentence.

| | count | share |
| --- | ---: | ---: |
| **Danger signs** (`emergency` 36 · `urgent` 79) | 115 | 44.6% |
| **Safe messages** | 143 | 55.4% |
| English | 148 | |
| Nigerian Pidgin | 67 | |
| Yoruba | 15 | |
| Hausa | 16 | |
| Igbo | 12 | |

**Positives** cover every category the detector claims: heavy bleeding, vaginal bleeding,
fits/convulsions, reduced fetal movement, ruptured membranes, pre-eclampsia signs (blurred vision,
severe headache, face/hand swelling), severe abdominal pain, difficulty breathing / chest pain,
fainting, high fever, postpartum foul-smelling lochia and mastitis, and the newborn signs
(not breathing / fast breathing, cold or floppy, not feeding, jaundice, fever, cord infection).

**Negatives are deliberately adversarial.** They are the near-misses that break naive keyword
matchers, not filler small talk:

- *anaemia and investigations* — "which food dey give blood", "my blood level is low", "blood test tomorrow", "my blood group is O positive"
- *bleeding that is not obstetric* — "my gums bleed when i brush", "small nose bleed this morning"
- *worry rather than symptom* — "i dey fear say i go bleed like my sister", "my sister had convulsion last year"
- *negations* — "my discharge has no smell", "i feel weak but i no faint", "the cord stump fell off and there is no smell or pus"
- *reassuring reports* — "baby was very active today", "my baby is still moving well"
- *homographs and everyday objects* — "this dress still fits me", "we get blackout since yesterday, no light", "the second line on the test was very faint", "my water bottle leak inside my bag"
- *physiological normals* — mild evening ankle swelling, day-three breast engorgement, exertional breathlessness that settles with rest
- *third parties* — "my husband has chest pain, should he see a doctor"
- normal chat: greetings in all five languages, food, appointments, costs, thanks

Roughly a third of rows carry a `note` explaining why the label is what it is.

### Row format

```json
{"text":"i am bleeding heavily since morning i have soaked three pads already",
 "lang":"en","expect":"emergency","sign":"heavy bleeding","note":"optional"}
```

- `expect` — `emergency` | `urgent` | `none`
- `sign` — optional; an expected **substring** of the detector's returned sign, used for the
  per-category table and sign accuracy
- `lang` — `en` | `pcm` | `yo` | `ha` | `ig`; the dominant language of the message

---

## What the metrics mean, clinically

Detection is scored **binary**: did the message trigger a danger response at all? That is the
decision that changes what the mother is told and whether her health worker is paged. Urgency level
and sign category are scored separately, because getting them wrong is a different (usually smaller)
harm than missing the message entirely.

| Metric | Formula | What it means for a mother |
| --- | --- | --- |
| **Sensitivity (recall)** | TP / (TP + FN) | Of mothers who really are in danger, what fraction does Bumply escalate? **1 − sensitivity is the miss rate — the fraction of dangerous messages that get an ordinary chatty reply instead of "go to hospital now".** |
| **Specificity** | TN / (TN + FP) | Of ordinary messages, what fraction are left alone? 1 − specificity is the false-alarm rate. |
| **Precision (PPV)** | TP / (TP + FP) | When Bumply raises an alarm, how often is it real? This is what a CHEW receiving alerts experiences. |
| **F1 / balanced accuracy** | — | Single-number summaries. Useful for tracking regressions, but neither should be the target. |
| **Level accuracy** | right level / detected | Of the danger signs caught, how many got the right urgency (`emergency` = go now vs `urgent` = be seen today)? |
| **Sign accuracy** | right category / labelled | Did it identify the right danger category? This matters because `dangerReply()` branches on it — newborn signs get baby-specific advice (keep the baby warm, skin-to-skin) and adult signs do not. |

### Why sensitivity is prioritised over specificity

The two error types are not symmetric, and pretending they are is how safety systems get people
killed.

- **A false negative can be fatal.** Obstetric haemorrhage and eclampsia can kill within hours. If a
  woman writes "blood dey rush comot" and the system replies with a cheerful nutrition tip, we have
  taken her one chance to be told to leave the house and spent it on reassurance. Bumply's entire
  reason for existing is to shorten "symptom → seek care"; a miss makes it longer than no app at all,
  because the mother has now been implicitly reassured by something she trusts.
- **A false positive costs a clinic visit.** Real, and not free — transport money, a day's trading
  income, childcare, and a CHEW's time. Repeated false alarms also cause alert fatigue and teach
  mothers to ignore warnings, which eventually costs sensitivity too. So specificity is a genuine
  constraint, not a rounding error.

But at a 1:100 or worse ratio of harm, we tune for recall. The operating point we target is
**sensitivity ≥ 95%, specificity ≥ 90%**, and the CI gate is on sensitivity only — a change that
raises false alarms is a discussion, a change that raises misses is a build failure.

Note also that the detector is not a diagnosis. Every escalation reply says so explicitly
("this na safety warning, no be diagnosis"). A false positive results in a woman being checked; a
false negative results in nothing happening at all. That asymmetry is the whole design.

---

## Labelling protocol

1. **Conservative labelling.** If a reasonable midwife reading the message would want the woman seen,
   the row is *not* `none`. Ambiguity resolves toward danger.
2. **Level.** `emergency` = WHO "go now" signs (heavy bleeding, convulsions, loss of consciousness,
   severe breathing difficulty, newborn not breathing / cold and floppy). `urgent` = "be seen today".
3. **Symptom vs talk.** A message is a positive only if it reports a symptom *the mother or her
   newborn has now*. Questions, past history, third parties, negations and expressions of fear are
   negatives, even when they contain the exact clinical vocabulary. Real messages are full of these,
   and they are where keyword matchers fall apart.
4. **Physiological normals are negatives**, with a `note` justifying it: evening dependent oedema of
   the feet, exertional breathlessness that settles, day-three breast engorgement without fever,
   pregnancy gingivitis, epistaxis that stops.
5. **Native-language rows are natural, not adversarial.** Yoruba/Hausa/Igbo positives are written the
   way a speaker would type them — including tone marks, and including symptoms for which no loanword
   exists. Where the message is realistically code-switched, it is written code-switched.

### Limitations (read before quoting these numbers)

- **Synthetic and curated, not sampled.** These messages were authored for this benchmark, not drawn
  from live traffic. The prior (how often each sign really occurs) does not match reality, so
  **precision here is not the precision a CHEW would experience** — in production, true danger signs
  are rare, so real-world PPV will be lower than the number below. Sensitivity and specificity are
  conditional on the true class and are the more transferable numbers.
- **Not yet clinically reviewed.** Labels were assigned against WHO/national danger-sign lists by an
  engineer, not signed off by a midwife. **A qualified midwife or obstetrician must review every
  label before these numbers appear in a grant application or a publication.** Inter-rater agreement
  on a second independent labeller should be reported alongside.
- **Language coverage is thin.** 43 of 258 rows are Yoruba/Hausa/Igbo. That is enough to show a
  problem exists (see Results) but not enough for a stable per-language estimate — the confidence
  intervals on 12–16 examples are very wide. Native-speaker authored sets of ≥100 messages per
  language are needed.
- **No spelling-error model.** Typos here are hand-written. Real WhatsApp typo distributions,
  transliteration variants and voice-note transcription errors are not represented.
- **One message at a time.** The detector sees a single message with no conversation history, so
  multi-turn escalation ("it is worse now") is out of scope for both the detector and this benchmark.
- **No adversarial/abuse testing** and no measurement of the downstream reply quality — only whether
  the correct branch was taken.

---

## Results

*Measured on 258 labelled messages. Re-run with `npm run eval:danger`;
the harness rewrites `docs/eval-danger-report.md` with the full failure list.*

```
                  predicted DANGER   predicted NONE
actual DANGER          115 (TP)          0 (FN)
actual SAFE            7 (FP)          136 (TN)

Sensitivity  100%   Specificity  95.1%
Precision    94.3%   F1  97%   Balanced accuracy  97.6%
```

**The CI gate passes** (`--fail-under-sens=90`, measured 100%).

### Per-language

| lang | n | sensitivity | specificity |
|---|---:|---:|---:|
| en | 148 | 100.0% | 95.7% |
| pcm | 67 | 100.0% | 94.9% |
| yo | 15 | 100.0% | 100.0% |
| ha | 16 | 100.0% | 75.0% |
| ig | 12 | 100.0% | 100.0% |

### What this benchmark found, and what changed

The first run of this harness scored **71.3% sensitivity / 69.2% specificity**, with
Yorùbá at **33.3%**, Igbo at **44.4%** and Hausa at **58.3%** — i.e. the detector was
substantially weaker for exactly the mothers least likely to be reading English. It
also surfaced a **safety bug**: when a mother wrote about her *baby's* fever, an adult
rule won the tie and she received advice about herself instead of newborn advice.

Fixes made in `lib/dangerSigns.ts` as a direct result:

1. **Tone-mark normalisation** — `ẹ̀jẹ̀` (fully marked) never matched `ẹjẹ`. Tone marks
   are now stripped while the dot-below (which distinguishes ẹ/e, ọ/o) is preserved.
2. **A severe-headache rule** — the single largest category gap; there was none at all.
3. **Word-order independence** (`near()`) — "swollen face" vs "face is swelling".
4. **Override patterns** so an incidental distractor ("my bp was fine … *and now I am
   seeing blood*") can no longer veto a symptom she is actually reporting.
5. **Multilingual anaemia/nutrition guards** — "food that gives blood" exists in
   Yorùbá, Hausa and Igbo too; only the English guard had been written.
6. **Newborn tie-breaking** when the message is about a baby (the safety bug above).
7. Tightened bare patterns (`blur`, `faint`, `fits`, `my water`, `cord`) and added
   narrow negation / past-tense / hypothetical suppressors.

Limitations still open: the benchmark is curated and synthetic rather than sampled
from real traffic, it has not yet been reviewed by a practising Nigerian midwife, and
the yo/ha/ig negative sets are small (3–4 messages each), so those specificity figures
carry wide confidence intervals. Hausa specificity (75%) is the weakest cell and the
next thing to work on.
