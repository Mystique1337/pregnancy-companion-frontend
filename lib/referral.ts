// Referral codes close the loop between "danger sign detected" and "she actually
// reached care" — the outcome metric that proves impact. The code is short enough
// to read out over a phone and unambiguous enough to say aloud in a noisy clinic.
import { randomInt } from "node:crypto";

// No O/0, I/1, S/5 — those are the pairs that get misheard on a bad line and
// mistyped at a clinic desk. 30 symbols ^ 4 = 810k codes, ample for a pilot.
const ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ2346789";

export function newReferralCode(): string {
  let body = "";
  for (let i = 0; i < 4; i++) body += ALPHABET[randomInt(ALPHABET.length)];
  return `BMP-${body}`;
}

/** Pull a referral code out of free text (a facility replying "arrived BMP-4KX9"). */
export function findReferralCode(text: string): string | null {
  const m = String(text || "").toUpperCase().match(/BMP[-\s]?([A-Z0-9]{4})/);
  return m ? `BMP-${m[1]}` : null;
}

/** The line we append to an urgent reply so she can be tracked to care. */
export function referralLine(code: string): string {
  return `📋 Show this code at the clinic: ${code}\n(It lets your health worker know you arrived.)`;
}
