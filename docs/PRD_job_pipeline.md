# PRD — Job Intelligence Pipeline
## HiredFox: Semantic Job Discovery + DE Data Platform

**Version:** 1.0  
**Date:** 2026-06-15  
**Status:** Draft  

---

## 1. Problem Statement

HiredFox helps users practice for interviews, but users still manually find job postings elsewhere, copy-paste job descriptions, and guess what to study. There is no connection between the jobs they are targeting and the interview preparation they do on the platform.

This feature closes that gap: ingest real job postings from the market, match them to each user's resume using semantic similarity, and let users launch interview sessions directly from a job they want to target.

It also adds a full data engineering layer to the product — a batch ingestion pipeline, a medallion data lake, dbt transformations, Airflow orchestration, and a vector-based matching engine — making this project credible for data engineering roles.

---

## 2. Goals

### Product Goals
- Surface relevant job postings personalized to each user's resume without requiring manual search
- Create a direct path from "I found a job I want" → "I practiced for exactly that job"
- Show market intelligence (trending skills, salary benchmarks, hiring companies) to help users understand the job landscape

### Data Engineering Goals
- Build a production-grade batch ingestion pipeline from multiple data sources
- Implement the medallion lakehouse architecture (Bronze → Silver → Gold)
- Use dbt for transformation modeling with data quality tests
- Orchestrate the pipeline with Apache Airflow
- Extend the existing Upstash Vector DB to enable semantic job-resume matching
- Demonstrate end-to-end DE competency: ingest → store → transform → enrich → serve

---

## 3. Success Metrics

| Metric | Target |
|--------|--------|
| Jobs ingested per daily run | > 500 new postings |
| Deduplication rate | > 30% (same job on multiple boards) |
| Resume-to-job match latency | < 500ms (vector search) |
| Match relevance (user clicks rate on top-5) | > 40% |
| Pipeline reliability | > 95% daily DAG success rate |
| Data freshness | Jobs no older than 24 hours in Gold layer |

---

## 4. User Stories

### Job Seeker (Primary)
- As a user, I want to see job postings matched to my resume so I don't have to search manually
- As a user, I want to click a job posting and immediately start a mock interview tailored to that job description
- As a user, I want to see a match score between my resume and a job so I know how well I fit
- As a user, I want to filter jobs by role, level, location, and remote status
- As a user, I want to see what skills I am missing for a job I want

### Market Intelligence Consumer
- As a user, I want to see which skills are trending in the market this week
- As a user, I want to see average salary ranges for my target role and level
- As a user, I want to see which companies are hiring most in my target stack

---

## 5. Feature Requirements

### 5.1 Job Discovery Page (`/jobs`)
- Grid/list of job postings with: company logo, role title, location, salary range, remote tag, match score (%), posted date
- Filter bar: role, level (Junior/Mid/Senior), location, remote/hybrid/onsite, salary range, company
- Sort: best match (default), newest, salary high-to-low
- Search: full-text search across title and description
- Pagination or infinite scroll (25 jobs per page)

### 5.2 Job Detail View (`/jobs/[id]`)
- Full job description
- Skills extracted from the JD (highlighted, tagged as "you have" / "you're missing")
- Match score breakdown: which skills from their resume match the JD
- CTA: **"Practice for this role"** → pre-fills interview generation form with role, level, tech stack from the JD
- CTA: **"Save job"** → bookmark for later

### 5.3 Resume Match Engine
- On page load, vector similarity between user's resume embedding and all job embeddings
- Returns top-N matches ranked by cosine similarity score
- Falls back to keyword match if user has no resume uploaded
- Match score displayed as percentage (0–100%)

### 5.4 Market Insights Page (`/jobs/insights`)
- Trending skills this week (bar chart, delta vs last week)
- Top hiring companies (by new posting count)
- Salary distribution by role + level (box plot / range)
- Remote vs onsite ratio by role
- New postings volume over time (line chart, 30 days)

### 5.5 "Practice for This Job" Flow
- User clicks the CTA on a job detail page
- Interview generation form pre-fills: role, level, tech stack (from JD skill extraction), company name
- User can edit before generating
- Interview questions are generated with the JD as additional context (injected into NVIDIA NIM prompt)
- After the interview, feedback explicitly maps to the JD requirements

### 5.6 Saved Jobs
- Users can bookmark job postings
- Saved jobs visible in a "Saved" tab on `/jobs`
- Notification (optional): "This job was posted 7 days ago — it may expire soon"

---

## 6. Data Engineering Architecture

### 6.1 Overview: Medallion Lakehouse

```
[Data Sources]
      ↓
[Bronze Layer]  — Raw, unmodified data, partitioned by source + date
      ↓
[Silver Layer]  — Cleaned, normalized, deduplicated
      ↓
[Gold Layer]    — Enriched: skills extracted, embeddings generated, match-ready
      ↓
[Serving Layer] — MySQL (structured queries) + Upstash Vector (semantic search)
      ↓
[Next.js UI]
```

All layers stored as **Parquet files** on S3 (or local filesystem for dev).  
Bronze and Silver are append-only. Gold is rebuilt from Silver on each run.

---

### 6.2 Data Sources

| Source | Method | Data Available | Schedule |
|--------|--------|----------------|----------|
| **HackerNews "Who's Hiring"** | Algolia public API | Title, description, company, location | Monthly (1st of month) |
| **RemoteOK** | Public JSON API (`remoteok.com/api`) | Title, tags, salary, company, URL | Daily |
| **Adzuna** | REST API (free tier, 50k calls/mo) | Title, description, salary, location, company | Daily |
| **Greenhouse ATS** | Public endpoints per company | Full JD, role, team, location | Daily per company |
| **Lever ATS** | Public endpoints per company | Full JD, role, location | Daily per company |

Greenhouse and Lever cover hundreds of tech companies (Stripe, Airbnb, Figma, etc.) without requiring scraping — they expose public JSON endpoints.

---

### 6.3 Bronze Layer — Raw Storage

**Path structure:**
```
data/
  jobs/
    bronze/
      source=remoteok/
        date=2025-06-15/
          jobs_20250615_143022.parquet
      source=adzuna/
        date=2025-06-15/
          jobs_20250615_143510.parquet
      source=hackernews/
        date=2025-06-01/
          jobs_20250601_000000.parquet
      source=greenhouse/
        company=stripe/
          date=2025-06-15/
            jobs_20250615_150000.parquet
```

**Schema (Bronze — raw, no standardization):**
```
source          STRING      -- remoteok | adzuna | hackernews | greenhouse
source_id       STRING      -- original ID from the source
raw_title       STRING
raw_description TEXT
raw_company     STRING
raw_location    STRING
raw_salary      STRING      -- "$120k-$160k", "£80,000", null
raw_tags        STRING      -- JSON array as string
raw_url         STRING
scraped_at      TIMESTAMP
```

Rules:
- Never modify Bronze data after writing
- Write failures must not corrupt existing files (write to temp, then rename)
- Failed scrape runs write a `_FAILED` marker file for Airflow alerting

---

### 6.4 Silver Layer — Cleaned & Normalized

**Transformations applied (dbt models):**
- Normalize job titles: map variants to canonical forms (`"Sr. SWE"` → `"Senior Software Engineer"`)
- Parse salary: extract `salary_min`, `salary_max`, `salary_currency` from raw string using regex + LLM fallback
- Standardize location: extract `city`, `country`, `is_remote`, `work_mode` (remote/hybrid/onsite)
- Detect experience level: infer `level` (Junior/Mid/Senior/Staff) from title and description if not provided
- Map role to canonical category: same 12 roles used in interview generation
- **Deduplicate:** fingerprint = `hash(company_name_normalized + title_normalized + location_normalized)`; keep earliest occurrence, record all source URLs

**Silver Schema:**
```
job_id              UUID        -- generated, stable across reruns (hash-based)
source              STRING
source_id           STRING
source_url          STRING
all_source_urls     JSON        -- array if same job found on multiple sources
company_name        STRING
company_name_norm   STRING      -- lowercase, stripped punctuation
title               STRING
title_norm          STRING
role_category       ENUM        -- Frontend | Backend | Full Stack | DevOps | ML Engineer | ...
level               ENUM        -- Junior | Mid | Senior | Staff | Not Specified
description_clean   TEXT        -- HTML stripped, whitespace normalized
location_city       STRING
location_country    STRING
is_remote           BOOLEAN
work_mode           ENUM        -- remote | hybrid | onsite | not_specified
salary_min          INTEGER     -- USD normalized, null if unknown
salary_max          INTEGER     -- USD normalized, null if unknown
salary_currency     STRING
posted_at           TIMESTAMP   -- parsed from source, best effort
ingested_at         TIMESTAMP
is_duplicate        BOOLEAN
canonical_job_id    UUID        -- points to earliest seen version if duplicate
```

**dbt models:**
```
models/
  staging/
    stg_jobs_remoteok.sql
    stg_jobs_adzuna.sql
    stg_jobs_hackernews.sql
    stg_jobs_greenhouse.sql
  intermediate/
    int_jobs_unioned.sql        -- UNION ALL sources
    int_jobs_deduped.sql        -- deduplication logic
    int_jobs_salary_parsed.sql  -- salary normalization
  marts/
    mart_jobs_silver.sql        -- final Silver table
```

**dbt tests (data quality):**
```yaml
- not_null: [job_id, source, title, company_name]
- unique: [job_id]
- accepted_values: level in [Junior, Mid, Senior, Staff, Not Specified]
- accepted_values: work_mode in [remote, hybrid, onsite, not_specified]
- dbt_utils.expression_is_true: salary_min <= salary_max (when both not null)
- dbt_utils.recency: posted_at within 48 hours for daily sources
```

---

### 6.5 Gold Layer — Enriched & Serving-Ready

Two enrichment steps run on Silver data:

**Step 1 — Skill Extraction (NVIDIA NIM)**

Prompt NVIDIA `meta/llama-3.1-8b-instruct` with the job description:
```
Extract a structured list of required technical skills from this job description.
Return JSON: { "required": [...], "preferred": [...], "domain": [...] }
```

Extracted skills are normalized against a canonical skills taxonomy (same 50+ skills used in interview generation).

**Step 2 — Embedding Generation (NVIDIA NIM)**

Use `nv-embedqa-e5-v5` to embed:
```
[TITLE] {title} [COMPANY] {company} [DESCRIPTION] {description_clean} [SKILLS] {required_skills joined}
```
Produces 1024-dim vector, stored in Upstash Vector with metadata:
```json
{
  "id": "job_{job_id}",
  "vector": [...1024 floats...],
  "metadata": {
    "job_id": "uuid",
    "title": "...",
    "company": "...",
    "role_category": "...",
    "level": "...",
    "work_mode": "...",
    "salary_min": 120000,
    "salary_max": 160000,
    "is_remote": true,
    "posted_at": "2025-06-15T00:00:00Z"
  }
}
```

**Gold Schema (MySQL `jobs_gold` table for structured queries):**
```sql
CREATE TABLE jobs_gold (
  job_id          VARCHAR(36) PRIMARY KEY,
  source          VARCHAR(50),
  source_url      TEXT,
  company_name    VARCHAR(255),
  title           VARCHAR(255),
  role_category   VARCHAR(50),
  level           VARCHAR(20),
  description     TEXT,
  location_city   VARCHAR(100),
  location_country VARCHAR(100),
  is_remote       BOOLEAN,
  work_mode       VARCHAR(20),
  salary_min      INT,
  salary_max      INT,
  required_skills JSON,
  preferred_skills JSON,
  posted_at       DATETIME,
  ingested_at     DATETIME,
  embedding_synced BOOLEAN DEFAULT FALSE,
  is_active       BOOLEAN DEFAULT TRUE,
  expires_at      DATETIME   -- 30 days after posted_at by default
);
```

---

### 6.6 Orchestration — Apache Airflow DAGs

**DAG 1: `job_ingestion_daily` (runs 2am UTC daily)**
```
Task 1: scrape_remoteok
Task 2: scrape_adzuna
Task 3: scrape_greenhouse          ← parallel with Task 1 & 2
Task 4: write_bronze_parquet       ← depends on Tasks 1-3
Task 5: dbt_run_staging            ← depends on Task 4
Task 6: dbt_run_intermediate       ← depends on Task 5
Task 7: dbt_run_marts              ← depends on Task 6
Task 8: dbt_test                   ← depends on Task 7
Task 9: enrich_skills_extraction   ← depends on Task 8 (LLM batch call)
Task 10: generate_embeddings       ← depends on Task 9
Task 11: sync_to_mysql             ← depends on Task 10
Task 12: sync_to_upstash_vector    ← depends on Task 10
Task 13: expire_old_jobs           ← mark jobs older than 30 days inactive
Task 14: notify_completion         ← log stats: N new, N deduped, N expired
```

**DAG 2: `hackernews_monthly` (runs 1st of each month, 6am UTC)**
```
Task 1: scrape_hn_hiring_thread
Task 2: write_bronze_parquet
Task 3: dbt_run_staging_hn
Task 4: merge_into_silver
Task 5: enrich_and_embed
Task 6: sync_to_serving_layer
```

**DAG 3: `analytics_refresh_daily` (runs 3am UTC, after ingestion)**
```
Task 1: compute_trending_skills     ← compare this week vs last week skill frequency
Task 2: compute_salary_benchmarks   ← percentiles by role + level
Task 3: compute_hiring_velocity     ← new postings per company, 7-day rolling
Task 4: write_analytics_tables      ← MySQL analytics_* tables
```

**Failure handling:**
- All tasks retry 2 times with 5-minute backoff
- On final failure: write `_FAILED` marker, trigger Slack/email alert (optional)
- Downstream tasks skipped on upstream failure (default Airflow behavior)
- Bronze is always written before any transformation — partial runs are recoverable

---

### 6.7 Semantic Matching Engine

**How matching works:**
```python
# On /jobs page load (Next.js API route)
user_resume_vector = upstash.fetch(f"resume_{user_id}")  # already stored from resume upload

matched_jobs = upstash.query(
    vector=user_resume_vector,
    top_k=50,
    filter={
        "is_active": True,
        "posted_at": { "$gte": "30_days_ago" }
    },
    include_metadata=True
)

# Return jobs sorted by cosine similarity score
```

**Match score calculation:**
- Raw cosine similarity (0–1) multiplied by 100 → displayed as `{score}% match`
- Skill overlap bonus: +5 points for each required skill from JD present in user's parsed_skills (capped at +20)
- Level penalty: -15 points if user's parsed_level is more than 1 step away from job's level

**No resume fallback:**
- Use role category + tech stack from user's interview history to construct a pseudo-vector
- Or surface trending / recently posted jobs sorted by newest

---

## 7. Database Schema Changes

```sql
-- New tables

CREATE TABLE jobs_gold (
  -- (full schema in section 6.5)
);

CREATE TABLE user_saved_jobs (
  id            VARCHAR(36) PRIMARY KEY,
  user_id       VARCHAR(255) NOT NULL,
  job_id        VARCHAR(36) NOT NULL,
  saved_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes         TEXT,
  UNIQUE KEY uq_user_job (user_id, job_id),
  FOREIGN KEY (job_id) REFERENCES jobs_gold(job_id)
);

CREATE TABLE analytics_trending_skills (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  skill           VARCHAR(100),
  role_category   VARCHAR(50),
  week_start      DATE,
  posting_count   INT,
  delta_pct       DECIMAL(5,2),    -- change vs prior week
  computed_at     DATETIME
);

CREATE TABLE analytics_salary_benchmarks (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  role_category   VARCHAR(50),
  level           VARCHAR(20),
  salary_p25      INT,
  salary_median   INT,
  salary_p75      INT,
  sample_size     INT,
  computed_at     DATETIME
);

CREATE TABLE pipeline_runs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  dag_id          VARCHAR(100),
  run_date        DATE,
  jobs_scraped    INT,
  jobs_new        INT,
  jobs_deduped    INT,
  jobs_embedded   INT,
  jobs_expired    INT,
  status          ENUM('success','partial','failed'),
  duration_secs   INT,
  error_message   TEXT,
  ran_at          DATETIME
);
```

---

## 8. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/jobs` | Paginated job list with filters + match scores |
| GET | `/api/jobs/[id]` | Single job detail with skill gap analysis |
| GET | `/api/jobs/match` | Top-N jobs matched to authenticated user's resume |
| POST | `/api/jobs/[id]/save` | Bookmark a job |
| DELETE | `/api/jobs/[id]/save` | Remove bookmark |
| GET | `/api/jobs/saved` | User's saved jobs |
| GET | `/api/jobs/insights/skills` | Trending skills data |
| GET | `/api/jobs/insights/salary` | Salary benchmark data |
| GET | `/api/jobs/insights/hiring` | Company hiring velocity |
| POST | `/api/jobs/[id]/prepare` | Create interview pre-filled from job JD |

**`GET /api/jobs` query params:**
```
?role=Backend
&level=Senior
&work_mode=remote
&salary_min=100000
&company=Stripe
&q=kubernetes
&sort=match|newest|salary_desc
&page=1
&limit=25
```

---

## 9. UI/UX Spec

### 9.1 Navigation
Add "Jobs" to the main nav (between Home and Interview).

### 9.2 `/jobs` — Job Discovery Page

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Find Your Next Role                                    │
│  [Search bar                                    🔍]     │
├──────────────────────┬──────────────────────────────────┤
│  FILTERS             │  Showing 247 jobs • Best match ▼ │
│  Role     [▼]        │                                  │
│  Level    [▼]        │  ┌──────────────────────────┐    │
│  Work Mode[▼]        │  │ [Logo] Stripe             │    │
│  Salary   [slider]   │  │ Senior Backend Engineer   │    │
│  Company  [▼]        │  │ San Francisco / Remote    │    │
│                      │  │ $160k–$200k  • 2 days ago │    │
│  [Clear filters]     │  │ ████████░░ 82% match      │    │
│                      │  │ [Python] [Go] [Kafka]     │    │
│                      │  │         [Practice →]      │    │
│                      │  └──────────────────────────┘    │
│                      │  ... more cards ...               │
└──────────────────────┴──────────────────────────────────┘
```

- Match score bar uses the app's existing color scheme
- Skills shown as tags, skills the user has highlighted in green, missing ones in muted
- "Practice →" CTA is primary action per card

### 9.3 `/jobs/[id]` — Job Detail Page

```
[← Back to Jobs]

[Company Logo]  Stripe
Senior Backend Engineer
San Francisco, CA · Remote · $160k–$200k · Posted 2 days ago

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Resume Match          82%   ████████░░
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Skills you have ✓          Skills to develop ✗
  ─────────────────          ──────────────────
  Python ✓                   Kafka ✗
  PostgreSQL ✓               Kubernetes ✗
  REST APIs ✓                gRPC ✗
  Docker ✓

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [🎯 Practice for this role]   [🔖 Save]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Job Description
  ───────────────
  [Full description text...]
```

### 9.4 `/jobs/insights` — Market Intelligence Page

Four sections using charts (Recharts, already common in Next.js projects):
1. **Trending Skills** — horizontal bar chart, top 10 skills this week with delta badges
2. **Top Hiring Companies** — ranked list with posting counts and 7-day trend
3. **Salary Benchmarks** — box plot by role + level (interactive: click role to filter)
4. **Job Volume Trend** — area chart, new postings per day over last 30 days

---

## 10. "Practice for This Job" Flow

```
User clicks [Practice for this role] on job card or detail page
        ↓
API call: POST /api/jobs/{id}/prepare
        ↓
Server extracts from job record:
  - role_category → maps to interview role
  - level → Junior/Mid/Senior
  - required_skills → pre-select tech stack
  - company_name → company field
  - description_clean → injected as context in NVIDIA NIM prompt
        ↓
Redirect to /interview with pre-filled form params
        ↓
User reviews and hits "Generate Questions"
        ↓
NVIDIA NIM prompt includes:
  "Generate {n} interview questions for a {level} {role} position at {company}.
   The candidate will be applying for this specific role: {jd_snippet}
   Focus on these required skills: {required_skills}"
        ↓
Interview session created, user starts voice interview
        ↓
Post-interview feedback maps back to JD requirements:
  "For this {company} {role} role, you demonstrated strong {skill} 
   but should work on {missing_skill} which is required in the JD."
```

---

## 11. Implementation Phases

### Phase 1 — Data Pipeline Foundation (Week 1–2)
- [ ] Set up Python project structure (`/pipeline` directory at repo root)
- [ ] Implement scrapers: RemoteOK + Adzuna + HackerNews
- [ ] Bronze layer writer (Parquet, partitioned)
- [ ] Basic dbt project setup with staging models
- [ ] Local Airflow setup (Docker Compose)
- [ ] Daily DAG skeleton with all tasks wired

**Deliverable:** Pipeline runs locally, Bronze Parquet files populated

### Phase 2 — Transformation + Data Quality (Week 2–3)
- [ ] dbt Silver models: deduplication, salary parsing, location normalization, level inference
- [ ] dbt tests for all quality checks
- [ ] dbt docs generated (data lineage graph)
- [ ] `pipeline_runs` table populated after each DAG run
- [ ] Add Greenhouse/Lever scrapers for 5–10 target companies

**Deliverable:** Clean, deduplicated Silver layer with passing dbt tests

### Phase 3 — Enrichment + Serving Layer (Week 3–4)
- [ ] Skill extraction batch job (NVIDIA NIM)
- [ ] Embedding generation + Upstash Vector sync
- [ ] MySQL `jobs_gold` table populated
- [ ] Analytics DAG: trending skills + salary benchmarks
- [ ] `analytics_*` tables populated

**Deliverable:** Gold layer ready, vector index populated with 1k+ jobs

### Phase 4 — API + UI (Week 4–5)
- [ ] `/api/jobs` endpoint with filters + match score
- [ ] `/api/jobs/[id]` endpoint with skill gap analysis
- [ ] `/api/jobs/insights/*` endpoints
- [ ] `/jobs` page — job discovery with filters
- [ ] `/jobs/[id]` page — job detail with skill gap
- [ ] `/jobs/insights` page — market intelligence charts
- [ ] "Practice for this role" flow end-to-end

**Deliverable:** Full feature visible and usable in the browser

### Phase 5 — Polish + CV-Readiness (Week 5–6)
- [ ] Save/bookmark feature
- [ ] Job expiry logic (30-day TTL)
- [ ] Pipeline monitoring dashboard (simple admin page showing `pipeline_runs` stats)
- [ ] Write README for the pipeline (`/pipeline/README.md`)
- [ ] Record a demo video showing the full flow

---

## 12. Technology Stack (New Additions)

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Scraping | Python `httpx` + `BeautifulSoup4` | HTTP requests + HTML parsing |
| Storage | Apache Parquet (`pyarrow`) | Columnar file format for Bronze/Silver |
| Transformation | **dbt-core** + **dbt-duckdb** | SQL transformations, tests, lineage |
| Query Engine | **DuckDB** | In-process analytics over Parquet files |
| Orchestration | **Apache Airflow** (Docker) | DAG scheduling, retries, monitoring |
| Enrichment LLM | NVIDIA NIM (existing) | Skill extraction from JDs |
| Embeddings | NVIDIA NIM (existing) | Job description vectorization |
| Vector Store | Upstash Vector (existing) | Semantic job-resume matching |
| Serving DB | MySQL (existing) | Structured job queries |
| Charts | Recharts | Market insights visualizations |

No new paid services required beyond what HiredFox already uses.

---

## 13. Out of Scope

- LinkedIn / Indeed scraping (legal/ToS risk, anti-bot measures)
- Job application tracking / ATS integration
- Email alerts for new matching jobs (potential future phase)
- Employer-side job posting (this is candidate-facing only)
- Real-time job feeds (daily batch is sufficient and simpler)
- Salary negotiation tooling
- Interview scheduling with real companies

---

## 14. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Source API rate limits | Medium | Stagger scraper tasks, cache responses, respect `Retry-After` headers |
| Job description quality varies | High | LLM skill extraction handles unstructured text; dbt tests catch anomalies |
| Upstash Vector index size cost | Low | Free tier supports 10k vectors; expire and delete old job vectors after 30 days |
| NVIDIA NIM cost for batch enrichment | Medium | Batch skill extraction in single API calls; cache results; only re-embed on content change |
| Airflow local setup complexity | Medium | Use official Docker Compose quickstart; document setup in README |
| Duplicate jobs across sources | High | Hash-based deduplication in Silver layer; tested via dbt unique test |

---

## 15. CV Talking Points

After building this, you can credibly say:

- *"Designed and implemented a medallion lakehouse architecture (Bronze/Silver/Gold) ingesting job postings from 4 sources, processing 500+ records daily"*
- *"Built ETL pipeline in Python with dbt transformation models, data quality tests, and Apache Airflow orchestration"*
- *"Implemented semantic job-resume matching using 1024-dimensional NVIDIA NIM embeddings and Upstash Vector similarity search"*
- *"Reduced duplicate job records by ~35% through hash-based deduplication across sources in the Silver layer"*
- *"Engineered skill extraction pipeline using LLM batch inference (NVIDIA NIM) to structure unstructured job descriptions into queryable skill taxonomies"*
- *"Built market analytics layer computing weekly skill demand trends and salary benchmarks across 10k+ job postings"*
