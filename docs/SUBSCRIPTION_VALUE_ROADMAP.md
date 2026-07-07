# Hired Fox — Making the Subscription Worth Buying

*Product strategy doc · July 2026 · Import into Notion (Import → Markdown)*

---

## 1. The Hard Truth First

Nobody pays $5/month for "10 interview generations." Quotas are how you *bill*, not why people *buy*. People pay for one thing in this category: **the belief that they will perform better in a real interview that is coming soon.**

Job seekers are the highest-intent buyers on the internet — an interview next Tuesday makes ₹425 look free. But they're also the shortest-lived customers (they churn the moment they're hired). So the product strategy has two jobs:

1. **Deepen value during the job hunt** → justify the price, convert free → paid fast
2. **Widen the funnel and add revenue lines** → survive the inherent churn

Everything below is organized by those two jobs.

---

## 2. What We Have Today (the foundation)

| Asset | Why it matters |
|---|---|
| Voice-first AI interviews | The core differentiator — most competitors are text/MCQ |
| Resume-tailored questions | Personalization hook already built |
| Company-targeted questions | Seed of the killer feature (see §3.2) |
| Scored feedback (5 categories) | Seed of the progress story (see §3.1) |
| Community interview library | Seed of the SEO/growth loop (see §5) |

The gap: today a user generates an interview, takes it once, reads a score, and leaves. **There is no reason to come back tomorrow.** That's the churn hole to fix before adding anything exotic.

---

## 3. Features That Sell Subscriptions

### 3.1 The Progress Story — *"Am I getting better?"* 🎯 build first

This is the single highest-leverage area. A score of 62/100 is a data point; a *trend* is a reason to keep practicing (and keep paying).

- **Progress dashboard** — score trend line across sessions, per-category radar chart (communication, technical, problem solving…), "your weakest area this week." All the data already exists in the `feedbacks` table. This is days of work, not weeks.
- **Session replay** — full transcript of every session, question by question, with your answer and what a strong answer looks like. (We already capture transcripts; we currently throw them away after scoring. Store them.)
- **Targeted drills** — after a session: "You scored 41 on problem solving. Here's a 10-minute drill on exactly that." Auto-generated, one click. This converts a bad score from a discouragement into a next step — and next steps are retention.
- **Readiness score per target role/company** — "You're 68% ready for your Amazon SDE-2 loop." Gamifies the whole journey and gives the subscription a finish line worth paying to reach.

> **Why it sells:** free users get their score; **history, replay, drills, and readiness are Pro.** This is the cleanest paywall in the product — you're not gating the toy, you're gating the improvement.

### 3.2 The Real Loop — *"Practice the actual interview I have"*

- **Job-description interviews** — paste a JD (or LinkedIn/Naukri URL) → interview generated from the actual requirements. Higher intent than picking from dropdowns; this is what someone with an interview on Friday actually wants.
- **Multi-round company loops** — real interviews aren't one call. Simulate the loop: recruiter screen → technical → behavioral → bar-raiser, each with a distinct interviewer persona and difficulty curve, with a loop-level report at the end. Nobody in the budget tier does this well.
- **Interviewer personas** — the friendly HR screen, the skeptical senior engineer, the stress interviewer. Same questions, different pressure. Cheap to build (prompt + voice variation), huge perceived value.
- **STAR story bank** — mine the resume for 6–8 behavioral stories, help the user rehearse them, then detect in feedback whether they actually used them. Behavioral prep is half of every loop and almost every competitor ignores it.

### 3.3 The Resume Wedge — *second product, same customer*

We already parse resumes. One step further:

- **Resume review & rewrite** — ATS-style score, bullet-by-bullet rewrite suggestions targeted at the role/JD. Standalone tools charge $20+ for this alone; for us it's one more Gemini/NIM prompt on data we already hold.
- **"Interview gap" analysis** — diff the resume against the target JD: "You'll get asked about Kubernetes; your resume doesn't mention it. Here's a prep drill."

### 3.4 Trust & Polish (quiet conversion drivers)

- **Hindi / Hinglish interview mode** — massive differentiation for the Indian market we're billing in. Vapi supports multilingual voices; competitors are English-only.
- **Pre-call mic check + practice question** — reduces the #1 support issue (dead mic → wasted session → refund request).
- **Email follow-up after each session** — score summary + one improvement tip + streak nudge. Email is the cheapest retention channel and we send zero today.

---

## 4. Pricing Architecture (recommendation)

| | Free | **Pro — ₹425/mo** | **Elite — ₹1,499/mo** (later) |
|---|---|---|---|
| Form generations | Unlimited ✅ (today) | Unlimited | Unlimited |
| Practice sessions | 1 lifetime | 10/month | 30/month |
| Score & basic feedback | ✅ | ✅ | ✅ |
| **Progress dashboard & history** | — | ✅ | ✅ |
| **Session replay + model answers** | — | ✅ | ✅ |
| **Targeted drills** | — | ✅ | ✅ |
| **JD-based interviews & company loops** | — | ✅ | ✅ |
| **Resume review & rewrite** | — | 1/month | Unlimited |
| Multilingual interviews | — | ✅ | ✅ |
| Human mock interview credits (§6) | — | — | 1/month |

Also:
- **Annual plan at ~40% off** (₹2,999/yr). Job hunts last 2–4 months; annual converts surprisingly well when framed as "cheaper than one month of a coach," and it pre-collects revenue from users who would churn at month 3.
- **7-day Pro trial on card** (or first Pro session free). The aha moment is *inside* Pro (replay + drills); let them taste it.
- Keep BYOK behind the flag for power users — it's a churn valve, not a revenue line.

---

## 5. Growth Loops (so marketing isn't just ads)

1. **Shareable report card** — beautiful OG-image score card ("I scored 84/100 on a Google SWE mock") → LinkedIn/X share → free distribution. Vanity + utility.
2. **SEO pages from the community library** — programmatic landing pages: */interviews/amazon-sde-2*, */interviews/react-frontend-junior* — real question previews, locked behind sign-up. This is the compounding channel; every generated interview adds inventory.
3. **Referral** — give a free Pro session, get a Pro session. Job seekers travel in cohorts (college batches, bootcamps, layoff groups).
4. **Streaks + daily question** — one 2-minute voice question per day, free. Builds the habit that the subscription monetizes.

---

## 6. New Revenue Lines (after Pro is solid)

- **B2B: colleges & bootcamps** — placement cells in India pay for exactly this. Cohort licenses (₹99–199/seat/mo), an admin dashboard of student readiness scores, bulk onboarding. One deal = hundreds of subscribers with near-zero CAC and much lower churn.
- **Human mock-interview marketplace** — verified FAANG/senior engineers at ₹1,500–3,000/session, we take 20–30%. The AI product becomes the funnel for the premium human product.
- **Recruiter screening mode** (bigger bet) — flip the product: companies send candidates an async AI screen and get structured scorecards. Same tech, 10× the willingness to pay. Park it until consumer is stable, but architect interviews/feedback so a `company_id` can slot in.

---

## 7. 90-Day Sequencing

**Days 0–30 — Retention foundation** *(all data already exists)*
1. Store full transcripts; session replay page
2. Progress dashboard (trend + radar)
3. Post-session email summary
4. Pre-call mic check

**Days 31–60 — The paywall with teeth**
5. Targeted drills from weak categories
6. JD-paste interview generation
7. Annual plan + 7-day trial
8. Shareable report card

**Days 61–90 — Differentiation & funnel**
9. Multi-round company loops (start with 3 companies done well)
10. Resume review & rewrite
11. First 50 SEO pages from the library
12. Hindi/Hinglish mode

**Explicitly NOT now:** mobile app, live coding editor, video avatars, recruiter mode. All defensible later; all distractions before retention works.

---

## 8. Metrics That Decide Everything

| Metric | Target | Why |
|---|---|---|
| **Activation**: signup → first completed session | > 40% within 24h | The aha moment is *hearing yourself answer*; everything upstream serves this |
| Week-1 return rate | > 30% | Proves the progress story works |
| Free → Pro conversion | 3–5% | Below 3% = paywall is gating the wrong things |
| Month-2 Pro retention | > 55% | Job-hunt churn is real; drills + readiness score fight it |
| Sessions per Pro user/month | 6+ | Under 4 → they won't renew; trigger drill nudges |
| CAC via SEO/referral share | > 50% of signups by day 90 | Paid ads on job seekers rarely pay back at ₹425/mo |

---

## 9. One-Line Thesis

> **Sell the mirror, not the microphone.** The voice interview is the demo; the reason to subscribe is watching yourself measurably get better at the exact interview you're about to walk into.
