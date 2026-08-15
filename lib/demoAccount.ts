// A single shared demo mother, so anyone with the link can see a populated app
// without signing up. Used by /demo and by scripts/reset-demo.mts.
//
// Deliberately one fixed account rather than a throwaway per visitor: it keeps
// the data curated, it is trivial to reset before an event, and there is no
// stream of junk records to clean up afterwards.
import bcrypt from "bcryptjs";
import { createMother, getMotherByEmail, updateMotherProfile } from "./queries";
import type { Mother } from "./queries";

export const DEMO_EMAIL = "demo@bumply.mom";
/** Not a secret. Published in the demo guide so anyone can sign in the normal way. */
export const DEMO_PASSWORD = "SeeBumply2026";

const WEEK = 26;

function dueDateFromWeek(week: number): string {
  // 40 weeks total, so the due date is (40 - week) weeks from today.
  const d = new Date();
  d.setDate(d.getDate() + (40 - week) * 7);
  return d.toISOString().slice(0, 10);
}

/** Find the demo mother, creating her if this is the first visit. */
export async function ensureDemoMother(): Promise<Mother> {
  const existing = await getMotherByEmail(DEMO_EMAIL);
  if (existing) return existing;

  const mother = await createMother({
    email: DEMO_EMAIL,
    password_hash: await bcrypt.hash(DEMO_PASSWORD, 10),
    full_name: "Blessing A.",
    partner_name: "Emeka",
    phone: "+2348000000000",
    due_date: dueDateFromWeek(WEEK),
    current_week: WEEK,
    weeks_completed: WEEK - 1,
    trimester: "second",
    first_pregnancy: true,
    ethnicity: "Nigerian",
    source: "demo",
    language: "en",
  });

  // A transport contact, so a danger-sign escalation has somewhere to go.
  try {
    await updateMotherProfile(mother.id, {
      transport_name: "Musa (keke driver)",
      transport_phone: "+2348030000000",
      transport_note: "Available day and night",
    });
  } catch {
    // Older schemas may not carry these columns; the demo still works without them.
  }

  return mother;
}
