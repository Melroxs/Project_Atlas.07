import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import atlasLogoFull from "@/assets/atlas-logo-full.png";
import atlasMark from "@/assets/atlas-mark.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Atlas — The AI Operating System for Insurance Restoration" },
      {
        name: "description",
        content:
          "Atlas is the AI operating system for insurance restoration companies. It sits above your existing stack — CRM, estimating, claims, photos, documents, emails, notes, supplements, team knowledge — and turns it into one connected intelligence layer.",
      },
      {
        property: "og:title",
        content: "Atlas — The AI Operating System for Insurance Restoration",
      },
      {
        property: "og:description",
        content:
          "Connect every system a restoration company already uses into a single intelligence layer. Close the loop on supplements, claims, and operational visibility.",
      },
      { property: "og:image", content: atlasLogoFull },
      { name: "twitter:image", content: atlasLogoFull },
    ],
  }),
  component: LandingPage,
});

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const SIGN_IN_URL = "https://project-atlas-07-web.vercel.app/login";
const PILOT_URL = "#pilot";

const PILOT_EVENT = "atlas:open-pilot";
function openPilot() {
  window.dispatchEvent(new CustomEvent(PILOT_EVENT));
}

/* ------------------------------------------------------------------ */
/* Shared atoms                                                        */
/* ------------------------------------------------------------------ */

function AtlasMark({ className = "" }: { className?: string }) {
  return (
    <img
      src={atlasMark}
      alt=""
      aria-hidden
      className={"select-none " + className}
      draggable={false}
    />
  );
}


function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.28em] text-atlas-cyan/80">
      <span className="h-px w-8 bg-atlas-cyan/60" />
      {children}
    </div>
  );
}

function PrimaryCta({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-atlas-cyan px-6 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-atlas-void transition-all duration-300 hover:shadow-[0_0_40px_-5px_var(--atlas-cyan)] focus:outline-none focus:ring-2 focus:ring-atlas-cyan focus:ring-offset-2 focus:ring-offset-atlas-void"
    >
      {children}
      <span
        aria-hidden
        className="inline-block transition-transform duration-300 group-hover:translate-x-0.5"
      >
        →
      </span>
    </a>
  );
}

function GhostCta({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.02] px-6 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-foreground/90 transition-all duration-300 hover:border-atlas-cyan/50 hover:bg-white/[0.04] hover:text-white"
    >
      {children}
    </a>
  );
}

function SectionShell({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={
        "relative w-full px-6 py-24 md:px-10 md:py-36 lg:px-16 " + className
      }
    >
      <div className="relative mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pilot Modal                                                         */
/* ------------------------------------------------------------------ */

function PilotModal() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setSubmitted(false);
    };
    window.addEventListener(PILOT_EVENT, onOpen);
    // Intercept any anchor pointing to the pilot placeholder
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(
        'a[href="#pilot"], button[data-pilot-open]'
      );
      if (el) {
        e.preventDefault();
        onOpen();
      }
    };
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener(PILOT_EVENT, onOpen);
      document.removeEventListener("click", onClick);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    // Placeholder submission — wire to backend later.
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    setSubmitted(true);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pilot-title"
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-atlas-void/85 px-4 py-10 backdrop-blur-md animate-reveal md:px-6 md:py-16"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-atlas-navy/95 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8),0_0_120px_-30px_color-mix(in_oklab,var(--atlas-violet)_35%,transparent)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{
            background:
              "radial-gradient(ellipse 60% 100% at 50% 0%, color-mix(in oklab, var(--atlas-cyan) 18%, transparent), transparent 70%)",
          }}
        />

        <button
          type="button"
          aria-label="Close"
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] font-mono text-sm text-white/70 transition hover:border-white/25 hover:text-white"
        >
          ×
        </button>

        <div className="relative px-6 pt-8 md:px-10 md:pt-10">
          <div className="flex items-center gap-2.5">
            <AtlasMark className="h-6 w-6" />
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-atlas-cyan">
              Design Partner Programme
            </span>
          </div>
          <h2
            id="pilot-title"
            className="mt-4 font-display text-2xl font-semibold leading-tight tracking-tight text-white md:text-3xl"
          >
            Apply for Pilot Access
          </h2>
          <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-white/65">
            Atlas is currently accepting a small number of insurance
            restoration companies as design partners. Selected teams work
            directly with us to shape the platform and get early access to
            supplement intelligence, claim context, and executive signal.
          </p>
        </div>

        {submitted ? (
          <div className="relative px-6 pb-10 pt-8 md:px-10">
            <div className="rounded-xl border border-atlas-cyan/25 bg-atlas-cyan/[0.05] p-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-atlas-cyan">
                Application received
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-white/85">
                Thank you for applying to the Atlas Design Partner Programme.
                We are reviewing applications and will contact selected
                companies with next steps.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/15 bg-white/[0.03] px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80 transition hover:border-white/30 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="relative space-y-5 px-6 pb-10 pt-8 md:px-10"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" name="name" required autoComplete="name" />
              <Field
                label="Company"
                name="company"
                required
                autoComplete="organization"
              />
              <Field label="Role" name="role" required />
              <Field
                label="Email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>

            <Field
              label="Approximately how many restoration claims does your company handle each month?"
              name="claims_per_month"
              placeholder="e.g. 40–60"
              required
            />

            <TextareaField
              label="How does your team currently manage supplements?"
              name="supplements_process"
              rows={3}
              placeholder="Tools, workflow, who owns it…"
              required
            />

            <TextareaField
              label="Walk us through every software platform your company uses — from first customer contact through final insurance payment."
              name="software_stack"
              rows={4}
              placeholder="CRM, estimating, photos, docs, comms, accounting…"
              required
            />

            <TextareaField
              label="Where do you believe your company loses the most time or revenue?"
              name="revenue_leak"
              rows={3}
              required
            />

            <div>
              <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
                If Atlas could automatically identify legitimate missed
                supplement opportunities, would you be interested in
                participating in the pilot?
              </label>
              <div className="flex flex-wrap gap-2">
                {["Yes", "Maybe", "No"].map((opt) => (
                  <label
                    key={opt}
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-white/70 transition hover:border-atlas-cyan/40 hover:text-white has-[:checked]:border-atlas-cyan has-[:checked]:bg-atlas-cyan/10 has-[:checked]:text-atlas-cyan"
                  >
                    <input
                      type="radio"
                      name="pilot_interest"
                      value={opt}
                      required
                      className="sr-only"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            <TextareaField
              label="Additional comments"
              name="notes"
              rows={2}
              placeholder="Optional"
            />

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/15 bg-transparent px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70 transition hover:border-white/30 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-atlas-cyan px-6 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-void transition hover:shadow-[0_0_40px_-5px_var(--atlas-cyan)] disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit Application"}
                <span aria-hidden>→</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
        {label}
        {required && <span className="ml-1 text-atlas-cyan">*</span>}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={500}
        className="w-full rounded-lg border border-white/10 bg-atlas-void/70 px-4 py-2.5 text-[14px] text-white placeholder:text-white/25 outline-none transition focus:border-atlas-cyan/60 focus:ring-2 focus:ring-atlas-cyan/20"
      />
    </label>
  );
}

function TextareaField({
  label,
  name,
  rows = 3,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  rows?: number;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
        {label}
        {required && <span className="ml-1 text-atlas-cyan">*</span>}
      </span>
      <textarea
        name={name}
        rows={rows}
        required={required}
        placeholder={placeholder}
        maxLength={2000}
        className="w-full resize-y rounded-lg border border-white/10 bg-atlas-void/70 px-4 py-2.5 text-[14px] leading-relaxed text-white placeholder:text-white/25 outline-none transition focus:border-atlas-cyan/60 focus:ring-2 focus:ring-atlas-cyan/20"
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Nav                                                                 */
/* ------------------------------------------------------------------ */


/* Nav                                                                 */
/* ------------------------------------------------------------------ */

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-atlas-void via-atlas-void/80 to-transparent" />
      <div className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
        <a href="#top" className="pointer-events-auto flex items-center gap-2.5">
          <AtlasMark className="h-7 w-7" />
          <span className="font-display text-[13px] font-semibold uppercase tracking-[0.28em] text-white">
            Project <span className="text-atlas-cyan">Atlas</span>
          </span>
        </a>

        <nav
          aria-label="Primary"
          className="pointer-events-auto hidden items-center gap-8 md:flex"
        >
          {[
            ["Intelligence", "#intelligence"],
            ["Supplements", "#supplements"],
            ["How it works", "#how"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/60 transition hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="pointer-events-auto flex items-center gap-3">
          <a
            href={SIGN_IN_URL}
            className="hidden font-mono text-[11px] uppercase tracking-[0.24em] text-white/70 transition hover:text-white sm:inline-block"
          >
            Sign in
          </a>
          <a
            href={PILOT_URL}
            className="rounded-full border border-atlas-cyan/40 bg-atlas-cyan/10 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-cyan transition hover:border-atlas-cyan hover:bg-atlas-cyan/15"
          >
            Apply for Pilot

          </a>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero product UI                                                     */
/* ------------------------------------------------------------------ */

function HeroProductUI() {
  return (
    <div className="relative mx-auto w-full max-w-5xl animate-drift">
      {/* Ambient light behind the interface */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-16 -z-10 rounded-[3rem] blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, color-mix(in oklab, var(--atlas-cyan) 25%, transparent), transparent 60%), radial-gradient(ellipse at 70% 80%, color-mix(in oklab, var(--atlas-violet) 22%, transparent), transparent 60%)",
        }}
      />

      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-atlas-navy/80 backdrop-blur-xl"
        style={{
          boxShadow:
            "0 40px 120px -20px rgba(0,0,0,0.7), 0 0 0 1px color-mix(in oklab, var(--atlas-cyan) 15%, transparent), 0 0 200px -40px color-mix(in oklab, var(--atlas-violet) 40%, transparent)",
        }}
      >
        {/* window chrome */}
        <div className="flex items-center justify-between border-b border-white/5 bg-atlas-void/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <AtlasMark className="h-4 w-4" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
              Atlas Intelligence
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-white/40">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-atlas-signal" />
            LIVE · analyzing 134 supplements
          </div>
        </div>

        <div className="grid gap-0 md:grid-cols-[220px_1fr]">
          {/* sidebar */}
          <aside className="hidden border-r border-white/5 bg-atlas-void/40 p-5 md:block">
            <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
              Workspace
            </div>
            <ul className="space-y-1 text-[13px]">
              {[
                ["Dashboard", true],
                ["Intelligence", false],
                ["Claims", false],
                ["Supplements", false],
                ["Documents", false],
                ["Adjusters", false],
                ["Interviews", false],
              ].map(([label, active]) => (
                <li
                  key={String(label)}
                  className={
                    "flex items-center gap-2 rounded-md px-3 py-2 transition " +
                    (active
                      ? "bg-atlas-cyan/10 text-atlas-cyan"
                      : "text-white/60 hover:bg-white/[0.03]")
                  }
                >
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " +
                      (active ? "bg-atlas-cyan" : "bg-white/20")
                    }
                  />
                  {label}
                </li>
              ))}
            </ul>
          </aside>

          {/* main */}
          <div className="p-5 md:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
                  Executive Intelligence
                </div>
                <h3 className="mt-1 font-display text-lg font-semibold text-white">
                  This week's operational signal
                </h3>
              </div>
              <div className="hidden font-mono text-[10px] text-white/40 sm:block">
                Updated 2m ago
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { v: "$42,380", l: "Revenue at risk", tint: "cyan" },
                { v: "18", l: "Supplements pending", tint: "violet" },
                { v: "6", l: "Claims need attention", tint: "cyan" },
                { v: "$127,500", l: "Recovered tracked", tint: "signal" },
              ].map((s, i) => (
                <div
                  key={s.l}
                  className="relative overflow-hidden rounded-lg border border-white/5 bg-atlas-void/60 p-4"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <div
                    className={
                      "font-display text-xl font-semibold " +
                      (s.tint === "cyan"
                        ? "text-atlas-cyan"
                        : s.tint === "violet"
                          ? "text-atlas-violet"
                          : "text-atlas-signal")
                    }
                  >
                    {s.v}
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
                    {s.l}
                  </div>
                  <div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-px"
                    style={{
                      background:
                        s.tint === "violet"
                          ? "linear-gradient(90deg, transparent, var(--atlas-violet), transparent)"
                          : "linear-gradient(90deg, transparent, var(--atlas-cyan), transparent)",
                    }}
                  />
                </div>
              ))}
            </div>

            {/* insight card */}
            <div className="mt-5 rounded-lg border border-atlas-cyan/20 bg-gradient-to-br from-atlas-cyan/[0.06] to-atlas-violet/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-atlas-cyan">
                <AtlasMark className="h-3.5 w-3.5" />
                Atlas noticed
              </div>
              <p className="text-[14px] leading-relaxed text-white/85">
                Revenue is stalling on{" "}
                <span className="font-semibold text-white">12 supplements</span>{" "}
                awaiting carrier approval — carrier response is{" "}
                <span className="text-atlas-violet">2.4× slower</span> than your
                90-day average.
              </p>
              <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-atlas-cyan/80">
                Review 6 highest-value first →
              </div>
            </div>
          </div>
        </div>

        {/* subtle scanning highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-40"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--atlas-cyan) 20%, transparent), transparent)",
          }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HERO                                                                */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section id="top" className="relative isolate overflow-hidden bg-atmosphere">
      {/* grid + atmosphere */}
      <div aria-hidden className="absolute inset-0 bg-grid-atlas opacity-[0.35] mask-fade-b" />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[80vh] opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 10%, color-mix(in oklab, var(--atlas-cyan) 18%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute right-[-10%] top-[30%] h-[500px] w-[500px] rounded-full opacity-40 blur-3xl"
        style={{ background: "color-mix(in oklab, var(--atlas-violet) 40%, transparent)" }}
      />

      <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-40 md:px-10 md:pb-32 md:pt-48">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-8 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-white/60 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-atlas-signal" />
              The AI operating system for insurance restoration
            </div>
          </div>

          <h1 className="font-display text-[13vw] font-semibold leading-[0.95] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[92px]">
            Know everything.
            <br />
            <span className="text-gradient-atlas">Miss nothing.</span>
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-balance text-base leading-relaxed text-white/65 md:text-lg">
            Atlas sits above the software your restoration company already
            runs — CRM, estimating, claims, photos, documents, emails, notes,
            supplements, and team knowledge — and turns all of it into one
            connected intelligence layer.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <PrimaryCta href={PILOT_URL}>Apply for Pilot Access</PrimaryCta>
            <GhostCta href="#intelligence">Explore Atlas</GhostCta>
          </div>

        </div>

        <div className="mt-20 md:mt-28">
          <HeroProductUI />
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-60">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/40">
            Sits above
          </span>
          {["JobNimbus", "CompanyCam", "Xactimate", "QuickBooks"].map((n) => (
            <span
              key={n}
              className="font-display text-sm font-medium tracking-wide text-white/50"
            >
              {n}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* ASK ATLAS                                                            */
/* ------------------------------------------------------------------ */

function AskAtlas() {
  return (
    <SectionShell id="intelligence">
      <div className="grid gap-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-20">
        <div>
          <Eyebrow>Ask Atlas</Eyebrow>
          <h2 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-6xl">
            Ask your company{" "}
            <span className="text-gradient-atlas">anything.</span>
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-white/60">
            When the company becomes legible to AI, operational questions
            become answerable. Atlas reads across every claim, document, and
            interview — then responds with context.
          </p>
        </div>

        {/* Chat surface */}
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] blur-3xl"
            style={{
              background:
                "radial-gradient(ellipse at 50% 40%, color-mix(in oklab, var(--atlas-violet) 20%, transparent), transparent 65%)",
            }}
          />
          <div className="panel-atlas overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
              <div className="flex items-center gap-2">
                <AtlasMark className="h-4 w-4" />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
                  Ask Atlas
                </span>
              </div>
              <span className="font-mono text-[10px] text-white/40">
                context: 97 claims · 134 supplements
              </span>
            </div>

            <div className="space-y-5 p-6 md:p-7">
              {/* user prompt */}
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-xl rounded-br-sm border border-white/10 bg-white/[0.04] px-4 py-3 text-[14px] text-white/90">
                  Where is revenue getting stuck?
                </div>
              </div>

              {/* atlas response */}
              <div className="flex items-start gap-3">
                <AtlasMark className="mt-1 h-6 w-6 shrink-0 animate-pulse-glow" />
                <div className="flex-1 space-y-4 text-[14px] leading-relaxed text-white/85">
                  <p className="animate-reveal" style={{ animationDelay: "0ms" }}>
                    <span className="text-gradient-atlas font-display text-2xl font-semibold">
                      $42,380
                    </span>{" "}
                    in potential revenue is currently associated with{" "}
                    <span className="text-white">18 unresolved supplement opportunities</span>.
                  </p>

                  <div
                    className="animate-reveal"
                    style={{ animationDelay: "200ms" }}
                  >
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-atlas-cyan/80">
                      Primary patterns detected
                    </div>
                    <ul className="space-y-1.5">
                      {[
                        "Missing documentation",
                        "Estimate discrepancies",
                        "Repeated adjuster delays",
                      ].map((s) => (
                        <li key={s} className="flex items-center gap-3">
                          <span className="h-1 w-1 rounded-full bg-atlas-cyan" />
                          <span className="text-white/75">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div
                    className="animate-reveal rounded-lg border border-atlas-cyan/25 bg-atlas-cyan/[0.06] p-4"
                    style={{ animationDelay: "400ms" }}
                  >
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-atlas-cyan">
                      Recommended action
                    </div>
                    <p className="text-white">
                      Review the 6 highest-value claims first.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/5 p-4">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-atlas-void/50 px-4 py-3">
                <span className="font-mono text-[11px] text-white/40">
                  Ask Atlas anything…
                </span>
                <div className="ml-auto flex h-7 w-7 items-center justify-center rounded-md bg-atlas-cyan/20 text-atlas-cyan">
                  →
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* QUERYABLE BUSINESS — architecture diagram                            */
/* ------------------------------------------------------------------ */

function QueryableArchitecture() {
  const inputs = [
    "Claims",
    "Documents",
    "Interviews",
    "Supplements",
    "Adjuster interactions",
    "Estimates",
    "Photos",
  ];
  const outputs = ["Answers", "Signals", "Recommendations", "Automation", "Business memory"];

  return (
    <SectionShell id="how" className="border-t border-white/5">
      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow>The architecture</Eyebrow>
        <h2 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-6xl">
          Your business becomes{" "}
          <span className="text-gradient-atlas">queryable.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/60">
          Every operational event becomes context. Nothing gets lost between
          systems, people, or weeks.
        </p>
      </div>

      <div className="relative mt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 50% 40% at 50% 50%, color-mix(in oklab, var(--atlas-violet) 22%, transparent), transparent 70%)",
          }}
        />

        <div className="grid items-center gap-10 md:grid-cols-[1fr_auto_1fr] md:gap-8">
          {/* inputs */}
          <ul className="space-y-2.5 md:text-right">
            {inputs.map((label, i) => (
              <li
                key={label}
                className="group flex items-center gap-3 md:justify-end"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/70 transition group-hover:text-atlas-cyan md:order-1 md:hidden" />
                <span className="font-mono text-[12px] uppercase tracking-[0.2em] text-white/70 transition group-hover:text-white">
                  {label}
                </span>
                <span
                  aria-hidden
                  className="h-px w-10 bg-gradient-to-r from-transparent to-atlas-cyan/60 md:order-1 md:from-atlas-cyan/60 md:to-transparent"
                />
              </li>
            ))}
          </ul>

          {/* core */}
          <div className="relative mx-auto flex h-52 w-52 items-center justify-center">
            <div
              aria-hidden
              className="absolute inset-0 animate-pulse-glow rounded-full"
              style={{
                background:
                  "radial-gradient(circle, color-mix(in oklab, var(--atlas-violet) 45%, transparent) 0%, transparent 70%)",
              }}
            />
            <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-atlas-cyan/30 bg-atlas-void/80 backdrop-blur">
              <div
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{
                  boxShadow:
                    "inset 0 0 40px color-mix(in oklab, var(--atlas-violet) 30%, transparent), 0 0 60px -10px color-mix(in oklab, var(--atlas-cyan) 40%, transparent)",
                }}
              />
              <AtlasMark className="relative h-16 w-16" />
            </div>
            <div className="absolute -bottom-8 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.28em] text-atlas-cyan">
              Atlas Intelligence
            </div>
          </div>

          {/* outputs */}
          <ul className="space-y-2.5">
            {outputs.map((label) => (
              <li key={label} className="group flex items-center gap-3">
                <span
                  aria-hidden
                  className="h-px w-10 bg-gradient-to-r from-atlas-violet/60 to-transparent"
                />
                <span className="font-mono text-[12px] uppercase tracking-[0.2em] text-white/80 transition group-hover:text-white">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* SUPPLEMENT INTELLIGENCE                                              */
/* ------------------------------------------------------------------ */

function SupplementIntelligence() {
  return (
    <SectionShell id="supplements" className="border-t border-white/5">
      <div className="grid gap-16 lg:grid-cols-2 lg:items-center lg:gap-20">
        <div>
          <Eyebrow>Supplement Intelligence</Eyebrow>
          <h2 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-6xl">
            Find the revenue{" "}
            <span className="text-gradient-atlas">hiding in the claim.</span>
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-white/60">
            Atlas connects claim context, documentation, estimates, adjuster
            interactions, and historical outcomes to surface opportunities that
            may require attention.
          </p>
        </div>

        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-8 -z-10 blur-3xl"
            style={{
              background:
                "radial-gradient(ellipse at 40% 40%, color-mix(in oklab, var(--atlas-cyan) 22%, transparent), transparent 65%)",
            }}
          />
          <div className="panel-atlas relative overflow-hidden rounded-2xl">
            {/* scan line */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-24 animate-scan bg-gradient-to-b from-atlas-cyan/40 to-transparent"
            />

            <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
                <AtlasMark className="h-4 w-4" />
                Claim Intelligence
              </div>
              <span className="font-mono text-[10px] text-atlas-cyan">
                scanning
              </span>
            </div>

            <div className="p-6 md:p-8">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
                    Claim #ATL-2847
                  </div>
                  <h3 className="mt-1 font-display text-2xl font-semibold text-white">
                    Residential Storm Damage
                  </h3>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
                    Potential Supplement
                  </div>
                  <div className="text-gradient-atlas mt-1 font-display text-3xl font-semibold md:text-4xl">
                    $8,420
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-atlas-cyan/80">
                  Signals
                </div>
                <ul className="space-y-2.5">
                  {[
                    ["Missing documentation", "cyan"],
                    ["Estimate discrepancy detected", "violet"],
                    ["Adjuster delay pattern", "cyan"],
                    ["3 unsupported line items", "violet"],
                  ].map(([s, tint]) => (
                    <li
                      key={s}
                      className="flex items-center gap-3 rounded-md border border-white/5 bg-atlas-void/50 px-4 py-3"
                    >
                      <span
                        className={
                          "h-1.5 w-1.5 rounded-full " +
                          (tint === "cyan"
                            ? "bg-atlas-cyan"
                            : "bg-atlas-violet")
                        }
                      />
                      <span className="text-[14px] text-white/85">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 rounded-lg border border-atlas-cyan/25 bg-atlas-cyan/[0.05] p-4">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-atlas-cyan">
                  Recommended Action
                </div>
                <p className="text-[14px] text-white">
                  Prepare documentation review before supplement submission.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* EXECUTIVE INTELLIGENCE — bold stats                                  */
/* ------------------------------------------------------------------ */
/* Section — Closed Loop                                               */
/* ------------------------------------------------------------------ */

function ClosedLoop() {
  const openItems = [
    "Supplements missed in the chaos of a busy claim",
    "Adjuster commitments buried in email threads",
    "Photos and scope changes never tied back to the estimate",
    "Institutional knowledge trapped in one project manager's head",
    "Executives learning about problems weeks after they happened",
  ];
  const closedItems = [
    "Every supplement opportunity surfaced with the evidence attached",
    "Every adjuster commitment captured and tracked to resolution",
    "Photos, documents, and scope reconciled against the estimate automatically",
    "Company knowledge accumulates across every claim, every person, every year",
    "Leadership sees revenue at risk before the week is out",
  ];

  return (
    <SectionShell id="closed-loop">
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.28em] text-white/60">
          <span className="h-1 w-1 rounded-full bg-atlas-violet" />
          The Transformation
        </div>
        <h2 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-6xl">
          From open loop
          <br />
          <span className="text-gradient-atlas">to closed loop.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-balance text-[15px] leading-relaxed text-white/60">
          Restoration companies don't lose revenue because their teams are
          careless. They lose it because knowledge is scattered across a dozen
          tools and no system can see all of it at once. Atlas closes the loop.
        </p>
      </div>

      <div className="relative mt-16 grid gap-6 md:mt-20 md:grid-cols-[1fr_auto_1fr] md:items-stretch md:gap-8">
        <ClosedLoopColumn
          state="open"
          eyebrow="Today · Open Loop"
          title="Scattered knowledge. Missed opportunities."
          items={openItems}
          accent="from-white/5 to-transparent"
          dotClass="bg-white/25"
        />

        <div className="flex items-center justify-center md:px-2">
          <div className="flex flex-col items-center gap-2">
            <div className="h-14 w-px bg-gradient-to-b from-transparent via-atlas-cyan/50 to-atlas-violet/50 md:hidden" />
            <div className="hidden h-px w-24 bg-gradient-to-r from-white/10 via-atlas-cyan/60 to-atlas-violet/60 md:block" />
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-atlas-cyan/40 bg-atlas-navy shadow-[0_0_40px_-6px_var(--atlas-cyan)]">
              <AtlasMark className="h-5 w-5" />
            </div>
            <div className="hidden h-px w-24 bg-gradient-to-r from-atlas-violet/60 via-atlas-cyan/60 to-white/10 md:block" />
            <div className="h-14 w-px bg-gradient-to-b from-atlas-violet/50 via-atlas-cyan/50 to-transparent md:hidden" />
          </div>
        </div>

        <ClosedLoopColumn
          state="closed"
          eyebrow="With Atlas · Closed Loop"
          title="Connected intelligence. Nothing falls through."
          items={closedItems}
          accent="from-atlas-cyan/[0.08] to-atlas-violet/[0.06]"
          dotClass="bg-atlas-cyan shadow-[0_0_10px_var(--atlas-cyan)]"
        />
      </div>
    </SectionShell>
  );
}

function ClosedLoopColumn({
  state,
  eyebrow,
  title,
  items,
  accent,
  dotClass,
}: {
  state: "open" | "closed";
  eyebrow: string;
  title: string;
  items: string[];
  accent: string;
  dotClass: string;
}) {
  return (
    <div
      className={
        "panel-atlas relative overflow-hidden rounded-2xl p-7 md:p-8 " +
        (state === "closed" ? "border-atlas-cyan/20" : "")
      }
    >
      <div
        aria-hidden
        className={"pointer-events-none absolute inset-0 bg-gradient-to-br " + accent}
      />
      <div className="relative">
        <div
          className={
            "font-mono text-[10px] uppercase tracking-[0.24em] " +
            (state === "closed" ? "text-atlas-cyan" : "text-white/40")
          }
        >
          {eyebrow}
        </div>
        <h3
          className={
            "mt-3 font-display text-xl font-semibold leading-snug tracking-tight md:text-2xl " +
            (state === "closed" ? "text-white" : "text-white/80")
          }
        >
          {title}
        </h3>
        <ul className="mt-6 space-y-3.5">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span
                className={"mt-2 h-1.5 w-1.5 shrink-0 rounded-full " + dotClass}
              />
              <span
                className={
                  "text-[14px] leading-relaxed " +
                  (state === "closed" ? "text-white/85" : "text-white/55")
                }
              >
                {item}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */



function ExecutiveIntelligence() {
  const signals = [
    { v: "$42,380", l: "Revenue at risk", tint: "cyan", size: "xl" },
    { v: "18", l: "Supplements pending", tint: "violet", size: "md" },
    { v: "6", l: "Claims need attention", tint: "cyan", size: "md" },
    { v: "$127,500", l: "Recovered opportunity tracked", tint: "signal", size: "xl" },
  ];

  return (
    <SectionShell className="border-t border-white/5">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>Executive Intelligence</Eyebrow>
        <h2 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-6xl">
          See the business{" "}
          <span className="text-gradient-atlas">
            before it becomes a problem.
          </span>
        </h2>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-6">
        {signals.map((s, i) => (
          <div
            key={s.l}
            className={
              "panel-atlas relative overflow-hidden rounded-2xl p-8 md:p-10 " +
              (s.size === "xl" ? "md:col-span-4" : "md:col-span-2")
            }
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-16 -z-10 opacity-70 blur-3xl"
              style={{
                background:
                  s.tint === "violet"
                    ? "radial-gradient(circle, color-mix(in oklab, var(--atlas-violet) 25%, transparent), transparent 60%)"
                    : s.tint === "signal"
                      ? "radial-gradient(circle, color-mix(in oklab, var(--atlas-signal) 20%, transparent), transparent 60%)"
                      : "radial-gradient(circle, color-mix(in oklab, var(--atlas-cyan) 25%, transparent), transparent 60%)",
              }}
            />
            <div
              className={
                "font-display font-semibold leading-none tracking-tight " +
                (s.size === "xl"
                  ? "text-6xl md:text-7xl lg:text-8xl"
                  : "text-5xl md:text-6xl") +
                " " +
                (s.tint === "cyan"
                  ? "text-atlas-cyan"
                  : s.tint === "violet"
                    ? "text-atlas-violet"
                    : "text-atlas-signal")
              }
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {s.v}
            </div>
            <div className="mt-5 font-mono text-[11px] uppercase tracking-[0.24em] text-white/60">
              {s.l}
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* ATLAS LEARNS — intelligence loop                                     */
/* ------------------------------------------------------------------ */

function AtlasLearns() {
  const steps = [
    "Inspection",
    "Interview",
    "Claim",
    "Supplement",
    "Carrier response",
    "Adjuster outcome",
    "Atlas learns",
    "Future recommendation improves",
  ];

  return (
    <SectionShell className="border-t border-white/5">
      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow>Institutional Memory</Eyebrow>
        <h2 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-6xl">
          Atlas remembers{" "}
          <span className="text-gradient-atlas">what the company learns.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/60">
          Atlas does not simply store records. It builds context — and gets
          smarter with every claim the company operates.
        </p>
      </div>

      <div className="relative mt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in oklab, var(--atlas-cyan) 15%, transparent), transparent 70%)",
          }}
        />

        <ol className="mx-auto grid max-w-5xl gap-3 md:grid-cols-4">
          {steps.map((s, i) => {
            const isLearn = s === "Atlas learns";
            return (
              <li
                key={s}
                className={
                  "panel-atlas relative flex items-center gap-3 rounded-xl p-4 " +
                  (isLearn ? "border-atlas-violet/40" : "")
                }
              >
                <span
                  className={
                    "font-mono text-[10px] " +
                    (isLearn ? "text-atlas-violet" : "text-atlas-cyan")
                  }
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={
                    "font-mono text-[11px] uppercase tracking-[0.18em] " +
                    (isLearn ? "text-white" : "text-white/80")
                  }
                >
                  {s}
                </span>
                {isLearn && (
                  <span
                    aria-hidden
                    className="absolute inset-0 -z-10 rounded-xl opacity-60"
                    style={{
                      background:
                        "radial-gradient(ellipse at 50% 50%, color-mix(in oklab, var(--atlas-violet) 25%, transparent), transparent 70%)",
                    }}
                  />
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-10 text-center font-mono text-[11px] uppercase tracking-[0.28em] text-white/40">
          The company gets smarter as it operates.
        </div>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* PRODUCT SCENES                                                       */
/* ------------------------------------------------------------------ */

function ProductScene({
  eyebrow,
  title,
  copy,
  reverse,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  reverse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
      <div className={reverse ? "lg:order-2" : ""}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="mt-5 font-display text-3xl font-semibold leading-[1.1] tracking-tight text-white md:text-4xl lg:text-5xl">
          {title}
        </h3>
        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/60">
          {copy}
        </p>
      </div>
      <div className={reverse ? "lg:order-1" : ""}>
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-8 -z-10 blur-3xl"
            style={{
              background:
                "radial-gradient(ellipse at 50% 50%, color-mix(in oklab, var(--atlas-cyan) 18%, transparent), transparent 65%)",
            }}
          />
          {children}
        </div>
      </div>
    </div>
  );
}

function ClaimInterface() {
  return (
    <div className="panel-atlas overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
          <AtlasMark className="h-4 w-4" /> Claim NPP-2026-0048
        </div>
        <span className="rounded-full bg-atlas-cyan/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-atlas-cyan">
          Hail damage
        </span>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
              Carrier
            </div>
            <div className="mt-1 text-[14px] text-white">State Farm</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
              Policy
            </div>
            <div className="mt-1 font-mono text-[13px] text-white/80">
              #SF-1234567
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
              Status
            </div>
            <div className="mt-1 text-[14px] text-atlas-signal">In Progress</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
              Revenue at risk
            </div>
            <div className="mt-1 font-display text-lg font-semibold text-atlas-cyan">
              $5,200
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          {[
            ["Inspection photos", "42 files"],
            ["Adjuster interviews", "3 sessions"],
            ["Estimate revisions", "2 versions"],
            ["Carrier communications", "11 threads"],
          ].map(([l, r]) => (
            <div
              key={l}
              className="flex items-center justify-between rounded-md border border-white/5 bg-atlas-void/50 px-4 py-2.5"
            >
              <span className="text-[13px] text-white/80">{l}</span>
              <span className="font-mono text-[11px] text-white/50">{r}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SupplementScene() {
  return (
    <div className="panel-atlas overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
          <AtlasMark className="h-4 w-4" /> Supplement Analysis
        </div>
        <span className="font-mono text-[10px] text-atlas-violet">
          pattern match · 87%
        </span>
      </div>
      <div className="space-y-4 p-6">
        <div className="rounded-lg border border-white/5 bg-atlas-void/60 p-4">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-atlas-cyan/80">
            Documentation signal
          </div>
          <p className="text-[13px] text-white/85">
            Roof underlayment referenced in estimate but not documented in
            inspection set. Historically indicates missed line item.
          </p>
        </div>
        <div className="rounded-lg border border-white/5 bg-atlas-void/60 p-4">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-atlas-cyan/80">
            Estimate signal
          </div>
          <p className="text-[13px] text-white/85">
            Xactimate line "R&amp;R Drip Edge" priced 18% below regional 30-day
            median.
          </p>
        </div>
        <div className="rounded-lg border border-atlas-violet/30 bg-atlas-violet/[0.06] p-4">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-atlas-violet">
            Opportunity surfaced
          </div>
          <p className="text-[14px] text-white">
            Consider supplement review — 4 signals aligned.
          </p>
        </div>
      </div>
    </div>
  );
}

function AdjusterScene() {
  return (
    <div className="panel-atlas overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
          <AtlasMark className="h-4 w-4" /> Adjuster Intelligence
        </div>
        <span className="font-mono text-[10px] text-white/40">
          14 historical claims
        </span>
      </div>
      <div className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-atlas-cyan/40 to-atlas-violet/40 font-display text-lg font-semibold text-white">
            MR
          </div>
          <div>
            <div className="font-display text-lg font-semibold text-white">
              M. Reynolds
            </div>
            <div className="font-mono text-[11px] text-white/50">
              Independent Adjuster · Southeast region
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { v: "6.1", l: "Avg response (d)", tint: "cyan" },
            { v: "68%", l: "Approval rate", tint: "signal" },
            { v: "High", l: "Doc scrutiny", tint: "violet" },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-md border border-white/5 bg-atlas-void/50 p-3"
            >
              <div
                className={
                  "font-display text-xl font-semibold " +
                  (s.tint === "cyan"
                    ? "text-atlas-cyan"
                    : s.tint === "violet"
                      ? "text-atlas-violet"
                      : "text-atlas-signal")
                }
              >
                {s.v}
              </div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-white/50">
                {s.l}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-atlas-cyan/80">
            Atlas memory
          </div>
          <p className="text-[13px] text-white/80">
            Typically requests supplementary photos before approving roofing
            supplements over $4,000.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProductExperience() {
  return (
    <SectionShell className="border-t border-white/5">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>Product experience</Eyebrow>
        <h2 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-6xl">
          Experience Atlas{" "}
          <span className="text-gradient-atlas">in action.</span>
        </h2>
      </div>

      <div className="mt-20 space-y-28 md:space-y-36">
        <ProductScene
          eyebrow="Scene one · Claim Intelligence"
          title="Atlas understands the complete context of a claim."
          copy="Every photo, interview, revision, and carrier thread — organized into a single intelligence view."
        >
          <ClaimInterface />
        </ProductScene>

        <ProductScene
          reverse
          eyebrow="Scene two · Supplement Opportunity"
          title="Atlas identifies patterns that may indicate missed supplement opportunities."
          copy="Signals across documentation, estimates, and prior outcomes align to surface where a closer look may pay off."
        >
          <SupplementScene />
        </ProductScene>

        <ProductScene
          eyebrow="Scene three · Adjuster Intelligence"
          title="Atlas remembers historical interactions and operational patterns."
          copy="Every past claim with every adjuster becomes context for the next negotiation."
        >
          <AdjusterScene />
        </ProductScene>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* INTEGRATIONS                                                         */
/* ------------------------------------------------------------------ */

function Integrations() {
  return (
    <SectionShell className="border-t border-white/5">
      <div className="grid gap-10 md:grid-cols-2 md:items-end md:gap-16">
        <div>
          <Eyebrow>Integrations</Eyebrow>
          <h2 className="mt-5 font-display text-3xl font-semibold leading-[1.1] tracking-tight text-white md:text-4xl lg:text-5xl">
            Atlas sits above{" "}
            <span className="text-gradient-atlas">your existing stack.</span>
          </h2>
        </div>
        <p className="max-w-md text-[15px] leading-relaxed text-white/60 md:justify-self-end">
          Atlas connects operational context across the systems your company
          already uses. It becomes the intelligence layer above the operational
          stack — not a replacement on day one.
        </p>
      </div>

      <div className="mt-14 flex flex-wrap items-center justify-between gap-x-10 gap-y-6 border-y border-white/5 py-8">
        {["JobNimbus", "CompanyCam", "Xactimate", "QuickBooks"].map((n) => (
          <div
            key={n}
            className="font-display text-xl font-medium tracking-tight text-white/45 transition hover:text-white/80 md:text-2xl"
          >
            {n}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* CLOSING                                                              */
/* ------------------------------------------------------------------ */

function Closing() {
  return (
    <section className="relative isolate overflow-hidden border-t border-white/5 bg-atmosphere px-6 py-40 md:py-56">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 50% 50% at 50% 60%, color-mix(in oklab, var(--atlas-violet) 22%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/3 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklab, var(--atlas-cyan) 60%, transparent), transparent)",
        }}
      />

      <div className="relative mx-auto max-w-4xl text-center">
       <img 
  src={atlasLogoFull} 
  alt="Atlas Logo" 
  className="mx-auto mb-10 h-75 w-400 animate-drift" 
/>
        <h2 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-6xl lg:text-7xl">
          Your company
          <br />
          already has the answers.
        </h2>
        <p className="text-gradient-atlas mt-6 font-display text-2xl font-semibold leading-tight tracking-tight md:text-4xl lg:text-5xl">
          Atlas knows where to find them.
        </p>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
          <PrimaryCta href={PILOT_URL}>Apply for Pilot Access</PrimaryCta>
          <GhostCta href={SIGN_IN_URL}>Sign in</GhostCta>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                               */
/* ------------------------------------------------------------------ */

function Footer() {
  return (
    <footer className="border-t border-white/5 bg-atlas-void px-6 py-10 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <AtlasMark className="h-5 w-5" />
          <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/60">
            Project Atlas
          </span>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
          AI operating system · restoration intelligence
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

function LandingPage() {
  return (
    <div className="min-h-screen bg-atlas-void text-foreground">
      <Nav />
      <main>
        <Hero />
        <AskAtlas />
        <QueryableArchitecture />
        <SupplementIntelligence />
        <ClosedLoop />
        <ExecutiveIntelligence />
        <AtlasLearns />
        <ProductExperience />
        <Integrations />
        <Closing />
      </main>
      <Footer />
      <PilotModal />
    </div>
  );
}

