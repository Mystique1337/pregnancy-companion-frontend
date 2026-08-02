// Public privacy notice (no auth, not behind middleware) — the plain-language
// half of Bumply's NDPA 2023 obligations. The formal mapping for reviewers and
// regulators lives in docs/DATA-PROTECTION.md; this page is written for the
// mother, her partner, and the health worker who enrols her.
import type { Metadata } from "next";
import { CONSENT_VERSION } from "@/lib/consent";

export const metadata: Metadata = {
  title: "Privacy — Bumply",
  description:
    "How Bumply collects, uses, stores and deletes your health information, and how to exercise your rights under the Nigeria Data Protection Act 2023.",
};

const UPDATED = "July 2026";
const CONTACT_EMAIL = "privacy@bumply.mom";
const CONTACT_WHATSAPP = "+234 815 417 4140";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2 className="feat-title" style={{ marginBottom: 12 }}>{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: "10px 0 0", paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it) => (
        <li key={it} style={{ display: "flex", gap: 10, fontSize: 15, lineHeight: 1.65, color: "var(--ink)" }}>
          <span style={{ color: "var(--pink)", flexShrink: 0 }}>•</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

const P: React.CSSProperties = { fontSize: 15, lineHeight: 1.75, color: "var(--ink-mid)", marginBottom: 10 };

export default function PrivacyPage() {
  return (
    <div className="app-shell" style={{ maxWidth: 720 }}>
      <p className="s-label">Nigeria Data Protection Act 2023</p>
      <h1 className="s-title" style={{ marginBottom: 10 }}>
        Your data, and <em>your</em> control over it
      </h1>
      <p className="muted" style={{ marginBottom: 8 }}>
        Bumply is a free pregnancy companion for Nigerian mothers on WhatsApp, Telegram and the web.
        This page explains, in plain English, what we keep about you, why, who can see it, and how to
        make us delete it.
      </p>
      <p className="muted" style={{ fontSize: 12, marginBottom: 24 }}>
        Last updated {UPDATED} · consent wording in use: <strong>{CONSENT_VERSION}</strong>
      </p>

      <div className="card" style={{ background: "var(--pink-pale)", border: "1px solid var(--pink-lt)", marginBottom: 24 }}>
        <p className="s-label" style={{ marginBottom: 10 }}>The short version</p>
        <Bullets
          items={[
            "We keep your messages, your pregnancy week and the health notes you share — nothing more than we need.",
            "We use them to answer you and to alert your health worker when you show a danger sign.",
            "Only your assigned health worker sees your information. We never sell it and never use it for adverts.",
            "You can say “delete my data” to the bot at any time, and everything about you is erased.",
            "You said yes before we started. You can take that yes back whenever you like.",
          ]}
        />
      </div>

      <Section title="What we collect">
        <p style={P}>Only what the service actually needs to help you:</p>
        <Bullets
          items={[
            "Who you are: your name, your phone or WhatsApp number, your email if you signed up on the web, and your language.",
            "Your pregnancy: your week or due date, whether this is your first pregnancy, your baby's birth date once your baby arrives.",
            "What you tell us: your chat messages (typed or spoken), journal entries, symptoms and moods, and photos you send us to read (an ANC card, a medicine, a test result).",
            "Health readings: blood pressure, weight, temperature and other vitals you or a health worker record, plus any alerts these raise.",
            "Optional details that help in an emergency: your state, LGA and ward, your usual facility, a transport contact, a next-of-kin contact, and a partner's number if you choose to add one.",
            "Technical basics needed to run the service: your login session cookie and, if you turn on notifications, your device's push subscription.",
          ]}
        />
        <p style={{ ...P, marginTop: 12, marginBottom: 0 }}>
          We do not ask for your NIN, your BVN, bank details or any government ID.
        </p>
      </Section>

      <Section title="Why we keep it, and on what basis">
        <p style={P}>
          Health information is <strong>sensitive personal data</strong> under the NDPA 2023. Our lawful
          basis is <strong>your consent</strong>: before Bumply stores anything from your conversation, it
          sends you a short notice and asks you to reply YES. We record the date and the exact version of
          that notice against your account.
        </p>
        <p style={{ ...P, marginBottom: 0 }}>
          We use your data to answer your questions with your own context in mind, to spot danger signs in
          your messages and tell you to get to a clinic, to alert your health worker so a human can follow
          up, to send you visit and immunization reminders, and to keep a safety record of what the system
          told you. We also count things like how many mothers we reach and how quickly they get to care —
          that reporting uses totals only, never your name.
        </p>
      </Section>

      <Section title="Who can see it">
        <Bullets
          items={[
            "Your assigned health worker (the CHW or clinician who enrolled you) sees your profile, your alerts and the vitals relevant to your care. No other health worker sees you.",
            "A small technical team maintains the system and can access data when it is needed to fix a fault or investigate a safety incident.",
            "Nobody else. We do not sell, rent or trade your data, we do not use it for advertising, and we do not share it with your family, employer or any other organisation unless you ask us to or the law requires it.",
            "If you choose to invite your partner or family with a share link, they see only your weekly pregnancy update — not your chats, journal or alerts. You can ask us to cancel that link.",
          ]}
        />
      </Section>

      <Section title="Where your data is kept">
        <p style={P}>
          Your records live in a <strong>self-hosted Postgres database that our team runs and controls</strong>
          {" "}— not in a third-party health platform. Access is restricted to the application and to the
          maintainers, over encrypted connections.
        </p>
        <p style={{ ...P, marginBottom: 0 }}>
          To make the service work, some information necessarily passes through other companies: WhatsApp or
          Telegram carry your messages, and the AI, voice and translation services that generate replies
          process the text of your question. Some of these run outside Nigeria. We only send them what is
          needed to produce your answer, and our providers are bound by their own contractual and security
          obligations. The full processor list is in our published data-protection documentation.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p style={{ ...P, marginBottom: 0 }}>
          We keep your data while you are using Bumply, and for up to <strong>24 months</strong> after your
          last activity so a returning mother finds her history intact. After that, inactive accounts are
          erased. If you ask us to delete earlier, we do it straight away — you do not have to wait. Safety
          records that no longer identify you (for example &ldquo;an alert was raised and closed&rdquo;) may
          be kept for reporting, with your name and contact details removed.
        </p>
      </Section>

      <Section title="Your rights">
        <p style={P}>Under the NDPA 2023 you can, at any time and free of charge:</p>
        <Bullets
          items={[
            "Ask what we hold about you and get a copy (right of access).",
            "Correct anything that is wrong — your week, your name, your phone number (right to rectification).",
            "Have everything erased (right to erasure).",
            "Withdraw your consent. Bumply then stops storing your conversation; withdrawing does not undo what was lawfully done before.",
            "Object to how we use your data, or ask us to restrict it.",
            "Complain to the Nigeria Data Protection Commission (NDPC) if you are not satisfied with how we respond.",
          ]}
        />
      </Section>

      <Section title="How to use your rights">
        <p style={P}>
          <strong>The fastest way:</strong> message the Bumply bot on WhatsApp or Telegram and say
          <strong> &ldquo;delete my data&rdquo;</strong> (or &ldquo;forget me&rdquo;, or just
          &ldquo;stop&rdquo;). Bumply asks you to confirm once, then erases your messages, journal, photos,
          vitals and personal details, and unlinks your phone number. This is deliberate: a mother who
          cannot read a policy page can still exercise her rights in her own words.
        </p>
        <p style={P}>
          <strong>On the web:</strong> sign in and use the delete option on your account page.
        </p>
        <p style={{ ...P, marginBottom: 0 }}>
          <strong>For access or correction:</strong> email us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--pink)" }}>{CONTACT_EMAIL}</a> and we
          will respond within 30 days.
        </p>
      </Section>

      <Section title="Children">
        <p style={{ ...P, marginBottom: 0 }}>
          Bumply is built for pregnant and new mothers. Adolescent mothers are among those most at risk in
          Nigeria, and we do not turn them away — but a mother under 18 should be enrolled and supported by
          a health worker, parent or guardian who is aware she is using the service.
        </p>
      </Section>

      <Section title="What Bumply is not">
        <p style={{ ...P, marginBottom: 0 }}>
          Bumply is not a doctor and not a diagnostic device. It gives general, safe guidance and pushes you
          towards a clinic whenever anything looks worrying. It never replaces your antenatal visits or your
          health worker&apos;s judgement.
        </p>
      </Section>

      <Section title="Contact">
        <p style={P}>
          Questions, complaints, or a request about your data:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--pink)" }}>{CONTACT_EMAIL}</a>, or message
          our WhatsApp line on <strong>{CONTACT_WHATSAPP}</strong>.
        </p>
        <p style={{ ...P, marginBottom: 0 }}>
          You may also contact the Nigeria Data Protection Commission (NDPC) directly if you believe your
          rights have been breached.
        </p>
      </Section>

      <p className="muted" style={{ fontSize: 12, marginTop: 18 }}>
        If we change this notice in a way that affects you, we will ask for your consent again with a new
        version number, and you will see it in your chat before anything changes.
      </p>
    </div>
  );
}
