# Danger-sign detector — evaluation report

Generated `2026-08-02 19:08 UTC` by `npx tsx scripts/eval-danger.mts`
Benchmark: `data/danger-benchmark.jsonl` · detector: `lib/dangerSigns.ts` (`detectDangerSign`)

```
Examples ................ 258
  danger (positives) .... 115   (emergency 36 · urgent 79)
  safe   (negatives) .... 143
```

## Confusion matrix (binary: any danger sign vs none)

```
                      predicted DANGER   predicted NONE
  actual DANGER              115 (TP)             0 (FN)
  actual SAFE                  7 (FP)           136 (TN)
```

## Headline metrics

```
  Sensitivity (recall) ...... 100.0%   115/115 danger messages caught      <-- the safety number
  Specificity ............... 95.1%   136/143 safe messages left alone
  Precision (PPV) ........... 94.3%   115/122 alerts were real
  F1 ........................ 97.0%
  Balanced accuracy ......... 97.6%
  Level accuracy (E vs U) ... 96.5%   111/115 detected cases got the right urgency
  Sign accuracy ............. 98.3%   113/115 sign-labelled cases mapped to the right category
    (of those detected) ..... 98.3%   113/115
```

## Per-language breakdown

```
  lang      n   pos   neg     sens     spec
  -----------------------------------------
  en      148    54    94   100.0%    95.7%
  pcm      67    28    39   100.0%    94.9%
  yo       15    12     3   100.0%   100.0%
  ha       16    12     4   100.0%    75.0%
  ig       12     9     3   100.0%   100.0%
```

## Per-category breakdown (grouped by expected sign)

```
  expected sign                    n  hit    sens   lvl   sign
  ------------------------------------------------------------
  heavy bleeding                  11   11  100.0% 10/11  10/11
  vaginal bleeding                10   10  100.0%  9/10   9/10
  fits/convulsions                 7    7  100.0%   7/7    7/7
  baby not moving                  8    8  100.0%   8/8    8/8
  waters broken                    6    6  100.0%   6/6    6/6
  vision changes                   6    6  100.0%   6/6    6/6
  severe headache                  6    6  100.0%   6/6    6/6
  sudden swelling                  6    6  100.0%   6/6    6/6
  severe abdominal pain            7    7  100.0%   7/7    7/7
  difficulty breathing             6    6  100.0%   6/6    6/6
  fainting                         5    5  100.0%   3/5    5/5
  high fever                       6    6  100.0%   6/6    6/6
  foul-smelling discharge          4    4  100.0%   4/4    4/4
  mastitis                         3    3  100.0%   3/3    3/3
  newborn: not breathing           6    6  100.0%   6/6    6/6
  newborn: cold                    4    4  100.0%   4/4    4/4
  newborn: not feeding             4    4  100.0%   4/4    4/4
  newborn: yellow                  4    4  100.0%   4/4    4/4
  newborn: fever                   3    3  100.0%   3/3    3/3
  newborn: cord                    3    3  100.0%   3/3    3/3
  ------------------------------------------------------------
  (negatives — expect: none)     143    7   95.1%     -      -
  columns: n = examples · hit = detected · sens = recall · lvl = right urgency (of detected) · sign = right category
```

## Failures

0 false negative(s) — a real danger sign the detector did NOT flag. These are the dangerous ones.
7 false positive(s) — a safe message the detector escalated. These cost trust and clinic time.

```
  FALSE NEGATIVES (missed danger) — 0

  FALSE POSITIVES (false alarm) — 7
    1. [en ] expected none      | got: emergency / difficulty breathing / chest pain
       "the room is stuffy and hard to breathe with this heat"
       why safe: environmental, not clinical
    2. [en ] expected none      | got: emergency / difficulty breathing / chest pain
       "my husband has chest pain, should he see a doctor"
       why safe: third party symptom - not the mother, should not trigger her escalation
    3. [en ] expected none      | got: emergency / difficulty breathing / chest pain
       "shortness of breath is normal in pregnancy right"
       why safe: a general question, not a report of breathlessness now
    4. [ha ] expected none      | got: urgent / high fever
       "zazzabi ba ni da shi yanzu, na sha magani"
       why safe: hausa: i do not have fever now, i took medicine - a negation
    5. [en ] expected none      | got: urgent / painful/swollen breast with fever (mastitis)
       "my breast is hard because milk is full, baby just fed and it is soft again"
       why safe: physiological fullness that resolves after a feed
    6. [pcm] expected none      | got: urgent / newborn: yellow skin or eyes (jaundice)
       "my baby wear yellow cloth for the naming ceremony"
       why safe: the word yellow about clothing
    7. [pcm] expected none      | got: emergency / newborn: cold, floppy or won't wake
       "my baby cries when i bath am with cold water"
       why safe: the water is cold, not the baby
```

## Under/over-triage (detected, but wrong urgency)

```
  [ha ] expected emergency -> got urgent    | vaginal bleeding
       "jini yana zuba sosai ban tsaya ba tun da safe"
  [yo ] expected urgent    -> got emergency | heavy bleeding
       "mo rí ẹjẹ díẹ̀ lóni, kò pọ̀ ṣùgbọ́n ó dẹ́rùbà mí"
  [pcm] expected emergency -> got urgent    | fainting / collapse
       "i just black out for kitchen now, i wake up on the floor"
  [en ] expected emergency -> got urgent    | fainting / collapse
       "she collapsed and is not waking up"
```

## Gate

```
  --fail-under-sens=90  ->  measured sensitivity 100.0%  ->  PASS
```

## Machine-readable summary

```
RESULT_JSON: {"total":258,"positives":115,"negatives":143,"tp":115,"fn":0,"fp":7,"tn":136,"sensitivity":100,"specificity":95.1,"precision":94.3,"f1":97,"balancedAccuracy":97.6,"levelAccuracy":96.5,"signAccuracy":98.3,"byLang":{"en":{"n":148,"sens":100,"spec":95.7},"pcm":{"n":67,"sens":100,"spec":94.9},"yo":{"n":15,"sens":100,"spec":100},"ha":{"n":16,"sens":100,"spec":75},"ig":{"n":12,"sens":100,"spec":100}},"failUnderSens":90,"pass":true}
```
