// ============================================================================
// Unit economics — what it actually costs to serve one mother for one month.
//
// WHY this file exists: funders score cost-per-beneficiary, and a number nobody
// can trace is a number nobody believes. Every constant below carries a `source`
// note saying where it came from (a published price list, or a line of code in
// this repo). Change a price in ONE place here and every figure in the admin
// dashboard moves with it.
//
// Rule we hold ourselves to: no precise-looking figure we cannot defend. Where a
// number is genuinely an estimate it is labelled PLACEHOLDER / rounded, and the
// basis is written down.
//
// Pure functions only — no I/O, no dates, no env reads. That keeps it testable
// and keeps the dashboard honest (same inputs → same numbers).
// ============================================================================

/** A recurring price expressed per GPU/CPU hour. */
export type HourlyRate = { readonly usdPerHour: number; readonly source: string };
/** A measured (or conservatively estimated) job duration. */
export type Duration = { readonly seconds: number; readonly source: string };
/** A flat monthly bill that does not move with the number of mothers. */
export type FixedCost = { readonly usdPerMonth: number; readonly source: string };
/** Token-metered inference pricing. */
export type TokenRate = { readonly usdPerMillionTokens: number; readonly source: string };
/** An estimated token count per interaction. */
export type TokenEstimate = { readonly tokens: number; readonly source: string };
/** A marginal cost we book per interaction (used where it is genuinely zero). */
export type PerCallCost = { readonly usdPerCall: number; readonly source: string };

/**
 * Average seconds in a month = 365.25 / 12 days. Used to turn "calls per month"
 * into an arrival rate; using 30 or 31 days would wobble the answer by ~2%.
 */
export const SECONDS_PER_MONTH = 2_629_800;

/** Default USD→NGN. A parameter everywhere, never hard-coded into a result. */
export const DEFAULT_USD_TO_NGN = 1600;

export const COST_MODEL = {
  // --- Inference: NVIDIA NIM (chat + vision) ------------------------------
  // Today this is genuinely ₦0: we run on NVIDIA's hosted NIM developer tier
  // (credit/rate-limited, no card). We model the PAID equivalent too, because
  // "it's free" is not a business model and a reviewer will (rightly) ask what
  // happens when the free tier ends.
  chat: {
    freeTier: {
      usdPerCall: 0,
      source:
        "NVIDIA NIM hosted developer tier (integrate.api.nvidia.com — see lib/ai.ts). " +
        "Credit-limited free access: today's marginal cost of a chat or vision call is $0.",
    } as PerCallCost,
    paidEquivalent: {
      usdPerMillionTokens: 0.9,
      source:
        "PLACEHOLDER, order-of-magnitude: commodity hosted inference for a 49B–70B open-weight " +
        "model sits around $0.60–$0.90 per 1M blended (input+output) tokens. We take the top of " +
        "that band so the figure is conservative. Confirm against the provider's live price sheet " +
        "before quoting it to a funder.",
    } as TokenRate,
    tokensPerTextReply: {
      tokens: 1400,
      source:
        "Envelope from this codebase: system prompt + up to 5 retrieved KB snippets " +
        "(lib/rag.ts groundingBlock) ≈ 1.2k input tokens, reply capped at max_tokens 150 " +
        "(lib/companion.ts). Rounded up to 1,400.",
    } as TokenEstimate,
  },

  // --- Modal, pay-per-use GPU/CPU -----------------------------------------
  // Modal bills per second for the container's whole lifetime, not just the
  // forward pass — so the scale-down tail below is part of the real bill.
  gpu: {
    tts: {
      usdPerHour: 1.1,
      source: "Modal published A10G rate ≈ $1.10/GPU-hour. SoroTTS runs on A10G (modal/mamabot.py gpu=\"A10G\").",
    } as HourlyRate,
    asr: {
      usdPerHour: 0.6,
      source: "Modal published T4 rate ≈ $0.60/GPU-hour. Whisper ASR runs on T4 (modal/vision.py gpu=\"t4\").",
    } as HourlyRate,
    translator: {
      usdPerHour: 0.05,
      source:
        "Modal CPU rate for the translator's 2-core / 4 GB container (modal/translator.py cpu=2, memory=4096) ≈ $0.05/hour.",
    } as HourlyRate,
  },
  duration: {
    voiceReplySeconds: {
      seconds: 25,
      source: "Observed SoroTTS generation for a 2–3 sentence reply on A10G ≈ 25s wall clock (lib/voice.ts caps input at 1,200 chars).",
    } as Duration,
    transcriptionSeconds: {
      seconds: 8,
      source: "Observed Whisper transcription of a typical voice note (≤ 60s audio) on T4 ≈ 8s.",
    } as Duration,
    translationSeconds: {
      seconds: 6,
      source: "Observed CPU translation of one reply-length passage ≈ 6s (lib/translate.ts).",
    } as Duration,
  },
  /**
   * The honest part most cost models leave out: after the last request Modal
   * keeps the container alive for 120s before scaling to zero, and bills for it.
   * This is not an assumption — it is `scaledown_window=120` in modal/mamabot.py,
   * modal/vision.py and modal/translator.py.
   */
  idleTailSeconds: {
    seconds: 120,
    source: "scaledown_window=120 in modal/mamabot.py, modal/vision.py, modal/translator.py (verbatim from the repo).",
  } as Duration,

  // --- Flat monthly infrastructure ----------------------------------------
  fixed: {
    railway: {
      usdPerMonth: 20,
      source: "Railway hosting for the Next.js app + cron ≈ $20/month at pilot size (railway.json in this repo).",
    } as FixedCost,
    supabaseVps: {
      usdPerMonth: 30,
      source: "Self-hosted Supabase (Postgres + pgvector) on a small VPS ≈ $30/month. Self-hosting is why this is a flat line, not per-row pricing.",
    } as FixedCost,
    evolutionWhatsapp: {
      usdPerMonth: 10,
      source: "Evolution API WhatsApp gateway container ≈ $10/month (lib/evolution.ts). No per-message fee on this path.",
    } as FixedCost,
    plunkEmail: {
      usdPerMonth: 0,
      source: "Plunk transactional email — free/negligible at pilot volume (lib/plunk.ts). Booked at $0; it is a rounding error, not a hidden cost.",
    } as FixedCost,
  },

  /**
   * Offline / on-device usage costs us nothing: the offline KB (lib/offlineKb.ts)
   * and the device's own speech synthesis (lib/localVoice.ts) run on the phone.
   * Kept explicit so the "works without a network" story shows up in the economics
   * as well as the product.
   */
  onDevice: {
    usdPerCall: 0,
    source: "Offline KB + device TTS run entirely on the handset (lib/offlineKb.ts, lib/localVoice.ts) — zero marginal cost to us.",
  } as PerCallCost,
} as const;

/** How much a single mother uses the service in a month. */
export type UsageProfile = {
  mothers: number;
  textRepliesPerMotherPerMonth: number;
  voiceRepliesPerMotherPerMonth: number;
  transcriptionsPerMotherPerMonth: number;
  translationsPerMotherPerMonth: number;
};

/**
 * Realistic pilot behaviour, not a best case: roughly weekly chat contact plus a
 * handful of voice interactions. Deliberately NOT the power user — overstating
 * usage would understate cost per interaction and flatter the model.
 */
export const DEFAULT_USAGE: UsageProfile = {
  mothers: 1000,
  textRepliesPerMotherPerMonth: 20,
  voiceRepliesPerMotherPerMonth: 4,
  transcriptionsPerMotherPerMonth: 4,
  translationsPerMotherPerMonth: 6,
};

export type CostBreakdownLine = { label: string; usd: number; note: string };

export type CostEstimate = {
  fixedUsd: number;
  variableUsd: number;
  totalUsd: number;
  perMotherUsd: number;
  perMotherNgn: number;
  breakdown: CostBreakdownLine[];
};

/**
 * Billed seconds for ONE call, including its fair share of the 120s scale-down tail.
 *
 * WHY not simply `service + 120`: Modal keeps the container warm for 120s after a
 * request, so two calls arriving inside the same window share ONE tail. Charging
 * every call a full tail is right at pilot volume (calls are minutes apart) but
 * badly overstates cost at scale, where the container is warm regardless.
 *
 * Model: Poisson arrivals at rate λ = calls / SECONDS_PER_MONTH. Billed idle after
 * a call is min(gap to next call, tail); for gap ~ Exp(λ),
 *
 *     E[min(gap, w)] = (1 − e^(−λw)) / λ
 *
 *   λ → 0  ⇒ the full w. Every call pays its own tail — the pilot case.
 *   λ → ∞  ⇒ 1/λ, i.e. total idle across the month converges to exactly one
 *            continuously-warm container. Extra concurrency above that is pure
 *            compute, which is already counted in the service seconds.
 *
 * Caveat we state out loud on the dashboard: this is first-order. It ignores the
 * tails of *additional* containers spun up for concurrency, so at very high volume
 * it is a floor rather than a ceiling.
 */
export function effectiveSecondsPerCall(
  serviceSeconds: number,
  callsPerMonth: number,
  idleTailSeconds: number = COST_MODEL.idleTailSeconds.seconds,
): number {
  if (callsPerMonth <= 0) return 0;
  const lambda = callsPerMonth / SECONDS_PER_MONTH;
  // -expm1(-x) is (1 - e^-x) without the cancellation error when x is tiny.
  const sharedTail = -Math.expm1(-lambda * idleTailSeconds) / lambda;
  return serviceSeconds + Math.min(sharedTail, idleTailSeconds);
}

/** Total monthly cost of one pay-per-use Modal service. */
function modalServiceUsd(rate: HourlyRate, job: Duration, callsPerMonth: number): number {
  if (callsPerMonth <= 0) return 0;
  const billedSeconds = effectiveSecondsPerCall(job.seconds, callsPerMonth) * callsPerMonth;
  return (billedSeconds / 3600) * rate.usdPerHour;
}

/** Flat infrastructure, independent of how many mothers are enrolled. */
export function fixedMonthlyUsd(): number {
  const f = COST_MODEL.fixed;
  return f.railway.usdPerMonth + f.supabaseVps.usdPerMonth + f.evolutionWhatsapp.usdPerMonth + f.plunkEmail.usdPerMonth;
}

/**
 * What chat inference WOULD cost per month if the NVIDIA free tier ended tomorrow.
 * Not part of the headline (it is genuinely $0 today) but shown alongside it, so
 * the number survives the obvious question.
 */
export function paidChatEquivalentUsd(usage: UsageProfile): number {
  const replies = usage.mothers * usage.textRepliesPerMotherPerMonth;
  const tokens = replies * COST_MODEL.chat.tokensPerTextReply.tokens;
  return (tokens / 1_000_000) * COST_MODEL.chat.paidEquivalent.usdPerMillionTokens;
}

/**
 * The headline calculation. Everything it returns is derived from COST_MODEL —
 * there are no free-floating numbers below this line.
 */
export function estimateMonthlyCost(usage: UsageProfile, usdToNgn: number = DEFAULT_USD_TO_NGN): CostEstimate {
  const mothers = Math.max(0, usage.mothers);

  const voiceCalls = mothers * usage.voiceRepliesPerMotherPerMonth;
  const asrCalls = mothers * usage.transcriptionsPerMotherPerMonth;
  const translationCalls = mothers * usage.translationsPerMotherPerMonth;
  const textReplies = mothers * usage.textRepliesPerMotherPerMonth;

  const ttsUsd = modalServiceUsd(COST_MODEL.gpu.tts, COST_MODEL.duration.voiceReplySeconds, voiceCalls);
  const asrUsd = modalServiceUsd(COST_MODEL.gpu.asr, COST_MODEL.duration.transcriptionSeconds, asrCalls);
  const translateUsd = modalServiceUsd(COST_MODEL.gpu.translator, COST_MODEL.duration.translationSeconds, translationCalls);

  const tail = COST_MODEL.idleTailSeconds.seconds;
  const secs = (job: Duration, calls: number) => effectiveSecondsPerCall(job.seconds, calls).toFixed(1);

  const breakdown: CostBreakdownLine[] = [
    {
      label: "Chat + vision inference (NVIDIA NIM)",
      usd: 0,
      note:
        `${textReplies.toLocaleString()} replies. Free developer tier today → $0. ` +
        `At paid rates this line would be ~$${paidChatEquivalentUsd(usage).toFixed(2)}/month ` +
        `(${COST_MODEL.chat.tokensPerTextReply.tokens.toLocaleString()} tokens/reply @ ` +
        `$${COST_MODEL.chat.paidEquivalent.usdPerMillionTokens.toFixed(2)}/1M tokens).`,
    },
    {
      label: "Voice replies — SoroTTS on Modal A10G",
      usd: ttsUsd,
      note:
        `${voiceCalls.toLocaleString()} replies × ${secs(COST_MODEL.duration.voiceReplySeconds, voiceCalls)}s billed ` +
        `(${COST_MODEL.duration.voiceReplySeconds.seconds}s generation + a share of the ${tail}s scale-down tail) @ ` +
        `$${COST_MODEL.gpu.tts.usdPerHour.toFixed(2)}/GPU-hr.`,
    },
    {
      label: "Voice notes in — Whisper on Modal T4",
      usd: asrUsd,
      note:
        `${asrCalls.toLocaleString()} transcriptions × ${secs(COST_MODEL.duration.transcriptionSeconds, asrCalls)}s billed ` +
        `(${COST_MODEL.duration.transcriptionSeconds.seconds}s + tail share) @ $${COST_MODEL.gpu.asr.usdPerHour.toFixed(2)}/GPU-hr.`,
    },
    {
      label: "Translation — Modal CPU",
      usd: translateUsd,
      note:
        `${translationCalls.toLocaleString()} translations × ${secs(COST_MODEL.duration.translationSeconds, translationCalls)}s billed ` +
        `(${COST_MODEL.duration.translationSeconds.seconds}s + tail share) @ $${COST_MODEL.gpu.translator.usdPerHour.toFixed(2)}/CPU-hr.`,
    },
    {
      label: "Offline / on-device use",
      usd: 0,
      note: "Offline KB answers and device speech run on the handset — no server cost, and they keep working with no network.",
    },
    { label: "Railway hosting", usd: COST_MODEL.fixed.railway.usdPerMonth, note: "Flat. Serves every mother — this is the line that amortises." },
    { label: "Supabase VPS (self-hosted Postgres + pgvector)", usd: COST_MODEL.fixed.supabaseVps.usdPerMonth, note: "Flat. Self-hosted, so no per-row or per-seat pricing." },
    { label: "WhatsApp gateway (Evolution API)", usd: COST_MODEL.fixed.evolutionWhatsapp.usdPerMonth, note: "Flat container cost; no per-message fee on this path." },
    { label: "Email (Plunk)", usd: COST_MODEL.fixed.plunkEmail.usdPerMonth, note: "Negligible at pilot volume; booked at $0 rather than hidden." },
  ];

  const fixedUsd = fixedMonthlyUsd();
  const variableUsd = ttsUsd + asrUsd + translateUsd;
  const totalUsd = fixedUsd + variableUsd;
  const perMotherUsd = mothers > 0 ? totalUsd / mothers : 0;

  return {
    fixedUsd,
    variableUsd,
    totalUsd,
    perMotherUsd,
    perMotherNgn: perMotherUsd * usdToNgn,
    breakdown,
  };
}

/** Convenience for the scenario curve: same behaviour per mother, different cohort size. */
export function withMothers(usage: UsageProfile, mothers: number): UsageProfile {
  return { ...usage, mothers };
}
