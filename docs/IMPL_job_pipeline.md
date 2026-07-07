# Implementation Plan — Job Intelligence Pipeline
## Step-by-Step Build Guide

---

## Folder Structure (Final State)

```
ai_mock_interviews/
├── app/
│   ├── (root)/
│   │   ├── jobs/
│   │   │   ├── page.tsx                     # /jobs — job discovery
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx                 # /jobs/[id] — job detail
│   │   │   └── insights/
│   │   │       └── page.tsx                 # /jobs/insights — market charts
│   └── api/
│       └── jobs/
│           ├── route.ts                     # GET /api/jobs (list + filters)
│           ├── match/route.ts               # GET /api/jobs/match (resume match)
│           ├── insights/
│           │   ├── skills/route.ts
│           │   ├── salary/route.ts
│           │   └── hiring/route.ts
│           └── [id]/
│               ├── route.ts                 # GET /api/jobs/[id]
│               ├── save/route.ts            # POST/DELETE bookmark
│               └── prepare/route.ts        # POST → create interview from JD
├── lib/
│   └── jobs/
│       ├── match.ts                         # vector similarity + score calc
│       ├── skillGap.ts                      # compare resume skills vs JD skills
│       └── queries.ts                       # MySQL queries for jobs_gold
├── components/
│   └── jobs/
│       ├── JobCard.tsx
│       ├── JobFilters.tsx
│       ├── MatchScoreBar.tsx
│       ├── SkillGapPanel.tsx
│       └── InsightsCharts.tsx
│
pipeline/                                    # Python DE project (repo root level)
├── docker-compose.yml                       # Airflow + Postgres meta DB
├── requirements.txt
├── dags/
│   ├── job_ingestion_daily.py
│   ├── hackernews_monthly.py
│   └── analytics_refresh_daily.py
├── scrapers/
│   ├── __init__.py
│   ├── base.py                              # BaseScaper ABC
│   ├── remoteok.py
│   ├── adzuna.py
│   ├── hackernews.py
│   └── greenhouse.py
├── bronze/
│   └── writer.py                            # Parquet partition writer
├── transform/                               # dbt project
│   ├── dbt_project.yml
│   ├── profiles.yml
│   ├── models/
│   │   ├── staging/
│   │   │   ├── stg_jobs_remoteok.sql
│   │   │   ├── stg_jobs_adzuna.sql
│   │   │   ├── stg_jobs_hackernews.sql
│   │   │   └── stg_jobs_greenhouse.sql
│   │   ├── intermediate/
│   │   │   ├── int_jobs_unioned.sql
│   │   │   ├── int_jobs_deduped.sql
│   │   │   └── int_jobs_normalized.sql
│   │   └── marts/
│   │       ├── mart_jobs_silver.sql
│   │       ├── mart_trending_skills.sql
│   │       └── mart_salary_benchmarks.sql
│   └── tests/
│       └── schema.yml
├── enrichment/
│   ├── skill_extractor.py                   # NVIDIA NIM batch skill extraction
│   └── embedder.py                          # NVIDIA NIM embeddings → Upstash Vector
└── serving/
    ├── sync_mysql.py                        # Gold layer → MySQL jobs_gold table
    └── expire_jobs.py                       # Mark 30-day-old jobs inactive
```

---

## Phase 1 — Python Pipeline Project Setup

### Step 1.1 — Create the pipeline directory

```bash
mkdir -p pipeline/scrapers pipeline/bronze pipeline/enrichment pipeline/serving
mkdir -p pipeline/transform/models/staging
mkdir -p pipeline/transform/models/intermediate
mkdir -p pipeline/transform/models/marts
mkdir -p pipeline/transform/tests
mkdir -p pipeline/dags
touch pipeline/__init__.py pipeline/scrapers/__init__.py
```

### Step 1.2 — `pipeline/requirements.txt`

```
httpx==0.27.0
beautifulsoup4==4.12.3
pyarrow==15.0.0
duckdb==0.10.1
dbt-core==1.7.0
dbt-duckdb==1.7.0
apache-airflow==2.9.1
python-dotenv==1.0.1
upstash-vector==0.4.0
mysql-connector-python==8.3.0
tqdm==4.66.0
tenacity==8.2.3
```

### Step 1.3 — `.env` for the pipeline (inside `/pipeline`)

```
ADZUNA_APP_ID=your_id
ADZUNA_APP_KEY=your_key
NVIDIA_API_KEY=your_key          # same as Next.js .env.local
UPSTASH_VECTOR_REST_URL=...      # same as Next.js .env.local
UPSTASH_VECTOR_REST_TOKEN=...
MYSQL_HOST=...
MYSQL_USER=...
MYSQL_PASSWORD=...
MYSQL_DATABASE=...
BRONZE_DATA_PATH=./data/bronze   # local path, swap for S3 URI in prod
```

---

## Phase 2 — Scrapers

### Step 2.1 — `pipeline/scrapers/base.py`

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

@dataclass
class RawJob:
    source: str
    source_id: str
    raw_title: str
    raw_description: str
    raw_company: str
    raw_location: str
    raw_url: str
    raw_salary: Optional[str] = None
    raw_tags: Optional[list] = field(default_factory=list)
    scraped_at: datetime = field(default_factory=datetime.utcnow)

class BaseScraper(ABC):
    source_name: str

    @abstractmethod
    def fetch(self) -> list[RawJob]:
        """Fetch raw job postings. Must return list[RawJob]."""
        ...
```

### Step 2.2 — `pipeline/scrapers/remoteok.py`

```python
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential
from .base import BaseScraper, RawJob

class RemoteOKScraper(BaseScraper):
    source_name = "remoteok"
    URL = "https://remoteok.com/api"

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    def fetch(self) -> list[RawJob]:
        headers = {"User-Agent": "HiredFox Job Pipeline/1.0"}
        resp = httpx.get(self.URL, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        jobs = []
        for item in data:
            if not isinstance(item, dict) or "id" not in item:
                continue
            jobs.append(RawJob(
                source=self.source_name,
                source_id=str(item.get("id")),
                raw_title=item.get("position", ""),
                raw_description=item.get("description", ""),
                raw_company=item.get("company", ""),
                raw_location=item.get("location", "Remote"),
                raw_url=item.get("url", ""),
                raw_salary=item.get("salary"),
                raw_tags=item.get("tags", []),
            ))
        return jobs
```

### Step 2.3 — `pipeline/scrapers/adzuna.py`

```python
import httpx, os
from tenacity import retry, stop_after_attempt, wait_exponential
from .base import BaseScraper, RawJob

class AdzunaScraper(BaseScraper):
    source_name = "adzuna"
    BASE_URL = "https://api.adzuna.com/v1/api/jobs/us/search/1"

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    def fetch(self) -> list[RawJob]:
        params = {
            "app_id": os.environ["ADZUNA_APP_ID"],
            "app_key": os.environ["ADZUNA_APP_KEY"],
            "results_per_page": 50,
            "what": "software engineer",
            "content-type": "application/json",
        }
        resp = httpx.get(self.BASE_URL, params=params, timeout=30)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        jobs = []
        for item in results:
            salary = None
            if item.get("salary_min"):
                salary = f"${int(item['salary_min'])}–${int(item.get('salary_max', item['salary_min']))}"
            jobs.append(RawJob(
                source=self.source_name,
                source_id=item["id"],
                raw_title=item.get("title", ""),
                raw_description=item.get("description", ""),
                raw_company=item.get("company", {}).get("display_name", ""),
                raw_location=item.get("location", {}).get("display_name", ""),
                raw_url=item.get("redirect_url", ""),
                raw_salary=salary,
            ))
        return jobs
```

### Step 2.4 — `pipeline/scrapers/hackernews.py`

```python
import httpx, re
from datetime import datetime
from tenacity import retry, stop_after_attempt, wait_exponential
from .base import BaseScraper, RawJob

class HackerNewsScraper(BaseScraper):
    """Fetches latest 'Who is Hiring' thread from HN Algolia API."""
    source_name = "hackernews"
    SEARCH_URL = "https://hn.algolia.com/api/v1/search"
    ITEMS_URL = "https://hn.algolia.com/api/v1/items/{}"

    def _get_hiring_thread_id(self) -> str:
        resp = httpx.get(self.SEARCH_URL, params={
            "query": "Ask HN: Who is hiring?",
            "tags": "story,author_whoishiring",
            "hitsPerPage": 1,
        })
        return resp.json()["hits"][0]["objectID"]

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    def fetch(self) -> list[RawJob]:
        thread_id = self._get_hiring_thread_id()
        resp = httpx.get(self.ITEMS_URL.format(thread_id), timeout=30)
        comments = resp.json().get("children", [])
        jobs = []
        for c in comments:
            text = c.get("text", "") or ""
            if not text:
                continue
            # Strip HTML tags for raw storage
            clean = re.sub(r"<[^>]+>", " ", text).strip()
            jobs.append(RawJob(
                source=self.source_name,
                source_id=str(c["id"]),
                raw_title=clean[:120],      # first 120 chars as pseudo-title
                raw_description=clean,
                raw_company="",             # to be extracted in Silver
                raw_location="",
                raw_url=f"https://news.ycombinator.com/item?id={c['id']}",
            ))
        return jobs
```

### Step 2.5 — `pipeline/scrapers/greenhouse.py`

```python
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential
from .base import BaseScraper, RawJob

# Add more slugs as needed — these are public Greenhouse board endpoints
COMPANIES = ["stripe", "airbnb", "figma", "notion", "linear", "vercel", "shopify"]

class GreenhouseScraper(BaseScraper):
    source_name = "greenhouse"
    BASE_URL = "https://boards-api.greenhouse.io/v1/boards/{}/jobs?content=true"

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    def _fetch_company(self, company_slug: str) -> list[RawJob]:
        resp = httpx.get(self.BASE_URL.format(company_slug), timeout=30)
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        jobs = []
        for item in resp.json().get("jobs", []):
            jobs.append(RawJob(
                source=self.source_name,
                source_id=str(item["id"]),
                raw_title=item.get("title", ""),
                raw_description=item.get("content", ""),
                raw_company=company_slug.title(),
                raw_location=item.get("location", {}).get("name", ""),
                raw_url=item.get("absolute_url", ""),
            ))
        return jobs

    def fetch(self) -> list[RawJob]:
        all_jobs = []
        for company in COMPANIES:
            all_jobs.extend(self._fetch_company(company))
        return all_jobs
```

---

## Phase 3 — Bronze Layer Writer

### Step 3.1 — `pipeline/bronze/writer.py`

```python
import os
import pyarrow as pa
import pyarrow.parquet as pq
from datetime import datetime, date
from dataclasses import asdict
from pathlib import Path
from scrapers.base import RawJob

SCHEMA = pa.schema([
    ("source",           pa.string()),
    ("source_id",        pa.string()),
    ("raw_title",        pa.string()),
    ("raw_description",  pa.large_string()),
    ("raw_company",      pa.string()),
    ("raw_location",     pa.string()),
    ("raw_url",          pa.string()),
    ("raw_salary",       pa.string()),
    ("raw_tags",         pa.list_(pa.string())),
    ("scraped_at",       pa.timestamp("us")),
])

def write_bronze(jobs: list[RawJob], base_path: str, run_date: date = None) -> str:
    """Write raw jobs to partitioned Parquet. Returns the output file path."""
    if not jobs:
        return ""

    run_date = run_date or date.today()
    source = jobs[0].source

    out_dir = Path(base_path) / f"source={source}" / f"date={run_date.isoformat()}"
    out_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    tmp_path = out_dir / f"jobs_{timestamp}.tmp.parquet"
    final_path = out_dir / f"jobs_{timestamp}.parquet"

    rows = [asdict(j) for j in jobs]
    for r in rows:
        r["raw_tags"] = r["raw_tags"] or []
        r["raw_salary"] = r["raw_salary"] or ""

    table = pa.Table.from_pylist(rows, schema=SCHEMA)
    pq.write_table(table, tmp_path, compression="snappy")
    tmp_path.rename(final_path)   # atomic rename — no partial files

    print(f"[bronze] Wrote {len(jobs)} jobs → {final_path}")
    return str(final_path)
```

---

## Phase 4 — dbt Transformation Layer

### Step 4.1 — `pipeline/transform/dbt_project.yml`

```yaml
name: hiredfox_jobs
version: '1.0.0'
config-version: 2
profile: hiredfox
model-paths: ["models"]
test-paths: ["tests"]
target-path: "target"
clean-targets: ["target", "dbt_packages"]

models:
  hiredfox_jobs:
    staging:
      +materialized: view
    intermediate:
      +materialized: table
    marts:
      +materialized: table
```

### Step 4.2 — `pipeline/transform/profiles.yml`

```yaml
hiredfox:
  target: dev
  outputs:
    dev:
      type: duckdb
      path: "../data/hiredfox.duckdb"     # single DuckDB file, reads Parquet
      threads: 4
```

### Step 4.3 — `pipeline/transform/models/staging/stg_jobs_remoteok.sql`

```sql
with source as (
    select * from read_parquet('../data/bronze/source=remoteok/**/*.parquet')
),

staged as (
    select
        'remoteok'                          as source,
        source_id,
        raw_title                           as title,
        raw_description                     as description,
        raw_company                         as company,
        raw_location                        as location,
        raw_url                             as url,
        raw_salary                          as salary_raw,
        raw_tags                            as tags,
        scraped_at
    from source
)

select * from staged
```

> Repeat the same pattern for `stg_jobs_adzuna.sql`, `stg_jobs_hackernews.sql`, `stg_jobs_greenhouse.sql` — only the source path and `source` literal differ.

### Step 4.4 — `pipeline/transform/models/intermediate/int_jobs_unioned.sql`

```sql
select * from {{ ref('stg_jobs_remoteok') }}
union all
select * from {{ ref('stg_jobs_adzuna') }}
union all
select * from {{ ref('stg_jobs_hackernews') }}
union all
select * from {{ ref('stg_jobs_greenhouse') }}
```

### Step 4.5 — `pipeline/transform/models/intermediate/int_jobs_normalized.sql`

```sql
with base as (
    select * from {{ ref('int_jobs_unioned') }}
),

normalized as (
    select
        source,
        source_id,
        url,
        company,
        lower(trim(regexp_replace(company, '[^a-zA-Z0-9 ]', '', 'g'))) as company_norm,
        title,
        lower(trim(title)) as title_norm,

        -- Work mode detection
        case
            when lower(title || ' ' || location || ' ' || description) like '%remote%' then 'remote'
            when lower(title || ' ' || location || ' ' || description) like '%hybrid%' then 'hybrid'
            when lower(title || ' ' || location || ' ' || description) like '%onsite%'
              or lower(title || ' ' || location || ' ' || description) like '%on-site%' then 'onsite'
            else 'not_specified'
        end as work_mode,

        (lower(location) like '%remote%') as is_remote,

        -- Level detection from title
        case
            when lower(title) like '%staff%' or lower(title) like '%principal%' then 'Staff'
            when lower(title) like '%senior%' or lower(title) like '% sr.%' or lower(title) like '% sr %' then 'Senior'
            when lower(title) like '%junior%' or lower(title) like '% jr.%' or lower(title) like '%entry%' then 'Junior'
            when lower(title) like '%mid%' or lower(title) like '%intermediate%' then 'Mid'
            else 'Not Specified'
        end as level,

        -- Role category
        case
            when lower(title) like '%frontend%' or lower(title) like '%front-end%' then 'Frontend'
            when lower(title) like '%backend%' or lower(title) like '%back-end%' then 'Backend'
            when lower(title) like '%full stack%' or lower(title) like '%fullstack%' then 'Full Stack'
            when lower(title) like '%devops%' or lower(title) like '%platform%' or lower(title) like '%sre%' then 'DevOps'
            when lower(title) like '%ml%' or lower(title) like '%machine learning%' or lower(title) like '%data scientist%' then 'ML Engineer'
            when lower(title) like '%data engineer%' then 'Data Engineer'
            when lower(title) like '%mobile%' or lower(title) like '%ios%' or lower(title) like '%android%' then 'Mobile'
            when lower(title) like '%security%' then 'Security'
            else 'Software Engineer'
        end as role_category,

        regexp_replace(description, '<[^>]+>', ' ', 'g') as description_clean,
        location,
        salary_raw,
        tags,
        scraped_at
    from base
    where title != '' and company != ''
)

select * from normalized
```

### Step 4.6 — `pipeline/transform/models/intermediate/int_jobs_deduped.sql`

```sql
with normalized as (
    select * from {{ ref('int_jobs_normalized') }}
),

-- Fingerprint = hash of normalized company + title + work_mode
fingerprinted as (
    select *,
        md5(company_norm || '||' || title_norm || '||' || work_mode) as fingerprint
    from normalized
),

-- Rank by scraped_at — keep the earliest seen per fingerprint
ranked as (
    select *,
        row_number() over (partition by fingerprint order by scraped_at asc) as rn
    from fingerprinted
),

-- Canonical map: fingerprint → earliest job
canonical as (
    select fingerprint, source_id as canonical_source_id
    from ranked where rn = 1
),

final as (
    select
        r.*,
        (r.rn > 1) as is_duplicate,
        c.canonical_source_id
    from ranked r
    join canonical c on r.fingerprint = c.fingerprint
)

select * from final
```

### Step 4.7 — `pipeline/transform/models/marts/mart_jobs_silver.sql`

```sql
select
    md5(source || source_id)               as job_id,
    source,
    source_id,
    url                                    as source_url,
    company                                as company_name,
    company_norm,
    title,
    title_norm,
    role_category,
    level,
    description_clean,
    location,
    is_remote,
    work_mode,
    salary_raw,
    tags,
    is_duplicate,
    canonical_source_id,
    fingerprint,
    scraped_at                             as ingested_at
from {{ ref('int_jobs_deduped') }}
where not is_duplicate     -- only canonical records in Silver
```

### Step 4.8 — `pipeline/transform/tests/schema.yml`

```yaml
version: 2

models:
  - name: mart_jobs_silver
    columns:
      - name: job_id
        tests:
          - not_null
          - unique
      - name: source
        tests:
          - not_null
          - accepted_values:
              values: ['remoteok', 'adzuna', 'hackernews', 'greenhouse']
      - name: title
        tests:
          - not_null
      - name: company_name
        tests:
          - not_null
      - name: level
        tests:
          - accepted_values:
              values: ['Junior', 'Mid', 'Senior', 'Staff', 'Not Specified']
      - name: work_mode
        tests:
          - accepted_values:
              values: ['remote', 'hybrid', 'onsite', 'not_specified']
      - name: role_category
        tests:
          - not_null
```

---

## Phase 5 — Enrichment

### Step 5.1 — `pipeline/enrichment/skill_extractor.py`

```python
import os, json, httpx
from tqdm import tqdm

NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
CANONICAL_SKILLS = [
    "Python","TypeScript","JavaScript","Go","Java","Rust","C++",
    "React","Next.js","Node.js","FastAPI","Django","Spring Boot",
    "PostgreSQL","MySQL","MongoDB","Redis","Elasticsearch",
    "Docker","Kubernetes","Terraform","AWS","GCP","Azure",
    "Kafka","Spark","Airflow","dbt","Pandas","PyTorch","TensorFlow",
    "GraphQL","REST APIs","gRPC","CI/CD","Git","Linux",
]

PROMPT = """
Extract required and preferred technical skills from the job description below.
Only use skills from this list: {skills_list}
Return ONLY valid JSON in this exact format:
{{"required": ["skill1", "skill2"], "preferred": ["skill3"]}}

Job Description:
{description}
""".strip()

def extract_skills(description: str) -> dict:
    body = {
        "model": "meta/llama-3.1-8b-instruct",
        "messages": [{"role": "user", "content": PROMPT.format(
            skills_list=", ".join(CANONICAL_SKILLS),
            description=description[:3000],   # token limit guard
        )}],
        "temperature": 0.1,
        "max_tokens": 256,
    }
    resp = httpx.post(
        NVIDIA_URL,
        json=body,
        headers={"Authorization": f"Bearer {os.environ['NVIDIA_API_KEY']}"},
        timeout=30,
    )
    resp.raise_for_status()
    text = resp.json()["choices"][0]["message"]["content"].strip()
    # Extract JSON block even if model wraps it in markdown
    start = text.find("{")
    end = text.rfind("}") + 1
    return json.loads(text[start:end]) if start != -1 else {"required": [], "preferred": []}


def batch_extract(jobs: list[dict]) -> list[dict]:
    """Add required_skills / preferred_skills to each job dict."""
    enriched = []
    for job in tqdm(jobs, desc="Extracting skills"):
        skills = extract_skills(job.get("description_clean", ""))
        enriched.append({**job, **skills})
    return enriched
```

### Step 5.2 — `pipeline/enrichment/embedder.py`

```python
import os, httpx
from tqdm import tqdm
from upstash_vector import Index

NVIDIA_EMBED_URL = "https://integrate.api.nvidia.com/v1/embeddings"

def embed_text(text: str) -> list[float]:
    resp = httpx.post(
        NVIDIA_EMBED_URL,
        json={"model": "nvidia/nv-embedqa-e5-v5", "input": [text[:2048]], "input_type": "passage"},
        headers={"Authorization": f"Bearer {os.environ['NVIDIA_API_KEY']}"},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["data"][0]["embedding"]

def build_embed_text(job: dict) -> str:
    skills = " ".join(job.get("required", []) + job.get("preferred", []))
    return f"[TITLE] {job['title']} [COMPANY] {job['company_name']} [SKILLS] {skills} [DESCRIPTION] {job['description_clean'][:1000]}"

def sync_to_vector(jobs: list[dict]):
    index = Index(
        url=os.environ["UPSTASH_VECTOR_REST_URL"],
        token=os.environ["UPSTASH_VECTOR_REST_TOKEN"],
    )
    batch = []
    for job in tqdm(jobs, desc="Embedding jobs"):
        vector = embed_text(build_embed_text(job))
        batch.append({
            "id": f"job_{job['job_id']}",
            "vector": vector,
            "metadata": {
                "job_id": job["job_id"],
                "title": job["title"],
                "company_name": job["company_name"],
                "role_category": job["role_category"],
                "level": job["level"],
                "work_mode": job["work_mode"],
                "is_remote": job["is_remote"],
                "salary_raw": job.get("salary_raw", ""),
                "source_url": job["source_url"],
                "required_skills": job.get("required", []),
            },
        })
        if len(batch) == 50:       # Upstash upsert batch limit
            index.upsert(vectors=batch)
            batch = []
    if batch:
        index.upsert(vectors=batch)
```

---

## Phase 6 — MySQL Gold Sync

### Step 6.1 — Migration: add new tables to MySQL

Run this against your Aiven MySQL database:

```sql
CREATE TABLE IF NOT EXISTS jobs_gold (
  job_id            VARCHAR(36)     PRIMARY KEY,
  source            VARCHAR(50)     NOT NULL,
  source_url        TEXT,
  company_name      VARCHAR(255)    NOT NULL,
  title             VARCHAR(255)    NOT NULL,
  role_category     VARCHAR(50),
  level             VARCHAR(20),
  description       MEDIUMTEXT,
  location          VARCHAR(255),
  is_remote         BOOLEAN         DEFAULT FALSE,
  work_mode         VARCHAR(20),
  salary_raw        VARCHAR(100),
  salary_min        INT,
  salary_max        INT,
  required_skills   JSON,
  preferred_skills  JSON,
  ingested_at       DATETIME        DEFAULT CURRENT_TIMESTAMP,
  is_active         BOOLEAN         DEFAULT TRUE,
  expires_at        DATETIME,
  INDEX idx_role    (role_category),
  INDEX idx_level   (level),
  INDEX idx_remote  (is_remote),
  INDEX idx_active  (is_active),
  INDEX idx_salary  (salary_min, salary_max)
);

CREATE TABLE IF NOT EXISTS user_saved_jobs (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id     VARCHAR(255)  NOT NULL,
  job_id      VARCHAR(36)   NOT NULL,
  saved_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY  uq_user_job   (user_id, job_id),
  FOREIGN KEY (job_id)      REFERENCES jobs_gold(job_id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
);

CREATE TABLE IF NOT EXISTS analytics_trending_skills (
  id              INT AUTO_INCREMENT  PRIMARY KEY,
  skill           VARCHAR(100),
  role_category   VARCHAR(50),
  week_start      DATE,
  posting_count   INT,
  delta_pct       DECIMAL(5,2),
  computed_at     DATETIME
);

CREATE TABLE IF NOT EXISTS analytics_salary_benchmarks (
  id              INT AUTO_INCREMENT  PRIMARY KEY,
  role_category   VARCHAR(50),
  level           VARCHAR(20),
  salary_p25      INT,
  salary_median   INT,
  salary_p75      INT,
  sample_size     INT,
  computed_at     DATETIME
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id              INT AUTO_INCREMENT  PRIMARY KEY,
  dag_id          VARCHAR(100),
  run_date        DATE,
  jobs_scraped    INT   DEFAULT 0,
  jobs_new        INT   DEFAULT 0,
  jobs_deduped    INT   DEFAULT 0,
  jobs_embedded   INT   DEFAULT 0,
  jobs_expired    INT   DEFAULT 0,
  status          ENUM('success','partial','failed'),
  duration_secs   INT,
  error_message   TEXT,
  ran_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Step 6.2 — `pipeline/serving/sync_mysql.py`

```python
import os, json, mysql.connector
from datetime import datetime, timedelta
from tqdm import tqdm

def get_conn():
    return mysql.connector.connect(
        host=os.environ["MYSQL_HOST"],
        user=os.environ["MYSQL_USER"],
        password=os.environ["MYSQL_PASSWORD"],
        database=os.environ["MYSQL_DATABASE"],
    )

def sync_jobs(jobs: list[dict]):
    conn = get_conn()
    cursor = conn.cursor()
    inserted = 0
    for job in tqdm(jobs, desc="Syncing to MySQL"):
        cursor.execute("""
            INSERT INTO jobs_gold
              (job_id, source, source_url, company_name, title, role_category,
               level, description, location, is_remote, work_mode, salary_raw,
               required_skills, preferred_skills, expires_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE
              is_active=TRUE,
              required_skills=VALUES(required_skills),
              preferred_skills=VALUES(preferred_skills),
              expires_at=VALUES(expires_at)
        """, (
            job["job_id"], job["source"], job["source_url"],
            job["company_name"], job["title"], job["role_category"],
            job["level"], job["description_clean"], job["location"],
            job["is_remote"], job["work_mode"], job.get("salary_raw"),
            json.dumps(job.get("required", [])),
            json.dumps(job.get("preferred", [])),
            datetime.utcnow() + timedelta(days=30),
        ))
        inserted += 1
    conn.commit()
    cursor.close()
    conn.close()
    return inserted

def expire_old_jobs():
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("UPDATE jobs_gold SET is_active=FALSE WHERE expires_at < NOW() AND is_active=TRUE")
    expired = cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return expired
```

---

## Phase 7 — Airflow DAG

### Step 7.1 — `pipeline/docker-compose.yml`

```yaml
version: '3.8'
x-airflow-common:
  &airflow-common
  image: apache/airflow:2.9.1
  environment:
    AIRFLOW__CORE__EXECUTOR: LocalExecutor
    AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://airflow:airflow@postgres/airflow
    AIRFLOW__CORE__LOAD_EXAMPLES: 'false'
  volumes:
    - ./dags:/opt/airflow/dags
    - ./scrapers:/opt/airflow/scrapers
    - ./bronze:/opt/airflow/bronze
    - ./enrichment:/opt/airflow/enrichment
    - ./serving:/opt/airflow/serving
    - ./transform:/opt/airflow/transform
    - ./data:/opt/airflow/data
    - ./.env:/opt/airflow/.env
  env_file: .env
  depends_on:
    postgres:
      condition: service_healthy

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: airflow
      POSTGRES_PASSWORD: airflow
      POSTGRES_DB: airflow
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "airflow"]
      interval: 10s
      retries: 5

  airflow-init:
    <<: *airflow-common
    command: db migrate

  airflow-webserver:
    <<: *airflow-common
    command: webserver
    ports:
      - "8080:8080"

  airflow-scheduler:
    <<: *airflow-common
    command: scheduler
```

### Step 7.2 — `pipeline/dags/job_ingestion_daily.py`

```python
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
import sys
sys.path.insert(0, "/opt/airflow")

default_args = {
    "owner": "hiredfox",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
}

def scrape_and_bronze(source_name: str, **context):
    from scrapers.remoteok import RemoteOKScraper
    from scrapers.adzuna import AdzunaScraper
    from scrapers.greenhouse import GreenhouseScraper
    from bronze.writer import write_bronze
    import os

    scrapers = {
        "remoteok": RemoteOKScraper,
        "adzuna": AdzunaScraper,
        "greenhouse": GreenhouseScraper,
    }
    scraper = scrapers[source_name]()
    jobs = scraper.fetch()
    write_bronze(jobs, base_path=os.environ["BRONZE_DATA_PATH"])
    context["ti"].xcom_push(key=f"{source_name}_count", value=len(jobs))

def run_dbt(**context):
    import subprocess
    result = subprocess.run(
        ["dbt", "run", "--project-dir", "/opt/airflow/transform",
         "--profiles-dir", "/opt/airflow/transform"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise Exception(f"dbt run failed:\n{result.stderr}")

def run_dbt_tests(**context):
    import subprocess
    result = subprocess.run(
        ["dbt", "test", "--project-dir", "/opt/airflow/transform",
         "--profiles-dir", "/opt/airflow/transform"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise Exception(f"dbt tests failed:\n{result.stdout}")

def enrich_and_sync(**context):
    import duckdb, os
    from enrichment.skill_extractor import batch_extract
    from enrichment.embedder import sync_to_vector
    from serving.sync_mysql import sync_jobs, expire_old_jobs

    con = duckdb.connect(os.environ.get("DUCKDB_PATH", "./data/hiredfox.duckdb"))
    jobs = con.execute("SELECT * FROM mart_jobs_silver LIMIT 200").df().to_dict("records")
    con.close()

    enriched = batch_extract(jobs)
    sync_to_vector(enriched)
    new_count = sync_jobs(enriched)
    expired_count = expire_old_jobs()

    print(f"Synced {new_count} jobs, expired {expired_count}")

with DAG(
    dag_id="job_ingestion_daily",
    default_args=default_args,
    start_date=datetime(2025, 1, 1),
    schedule_interval="0 2 * * *",    # 2am UTC daily
    catchup=False,
    tags=["hiredfox", "jobs"],
) as dag:

    t_remoteok    = PythonOperator(task_id="scrape_remoteok",    python_callable=scrape_and_bronze, op_kwargs={"source_name": "remoteok"})
    t_adzuna      = PythonOperator(task_id="scrape_adzuna",      python_callable=scrape_and_bronze, op_kwargs={"source_name": "adzuna"})
    t_greenhouse  = PythonOperator(task_id="scrape_greenhouse",  python_callable=scrape_and_bronze, op_kwargs={"source_name": "greenhouse"})
    t_dbt_run     = PythonOperator(task_id="dbt_run",            python_callable=run_dbt)
    t_dbt_test    = PythonOperator(task_id="dbt_test",           python_callable=run_dbt_tests)
    t_enrich      = PythonOperator(task_id="enrich_and_sync",    python_callable=enrich_and_sync)

    [t_remoteok, t_adzuna, t_greenhouse] >> t_dbt_run >> t_dbt_test >> t_enrich
```

---

## Phase 8 — Next.js API Layer

### Step 8.1 — `lib/jobs/queries.ts`

```typescript
import { pool } from "@/lib/db";  // existing MySQL pool

export async function getJobs(filters: {
  role?: string; level?: string; work_mode?: string;
  salary_min?: number; q?: string; page?: number; limit?: number;
}) {
  const { role, level, work_mode, salary_min, q, page = 1, limit = 25 } = filters;
  const offset = (page - 1) * limit;
  const conditions: string[] = ["is_active = TRUE"];
  const params: unknown[] = [];

  if (role)       { conditions.push("role_category = ?"); params.push(role); }
  if (level)      { conditions.push("level = ?"); params.push(level); }
  if (work_mode)  { conditions.push("work_mode = ?"); params.push(work_mode); }
  if (salary_min) { conditions.push("salary_min >= ?"); params.push(salary_min); }
  if (q)          { conditions.push("(title LIKE ? OR description LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }

  const where = conditions.join(" AND ");
  params.push(limit, offset);

  const [rows] = await pool.query(
    `SELECT job_id, source_url, company_name, title, role_category, level,
            location, is_remote, work_mode, salary_raw, required_skills, ingested_at
     FROM jobs_gold WHERE ${where}
     ORDER BY ingested_at DESC LIMIT ? OFFSET ?`,
    params
  );
  return rows;
}

export async function getJobById(jobId: string) {
  const [rows]: any = await pool.query(
    `SELECT * FROM jobs_gold WHERE job_id = ? AND is_active = TRUE`,
    [jobId]
  );
  return rows[0] ?? null;
}
```

### Step 8.2 — `lib/jobs/match.ts`

```typescript
import { Index } from "@upstash/vector";
import { pool } from "@/lib/db";

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});

export async function getMatchedJobs(userId: string, topK = 25) {
  // Fetch user's resume vector (stored as "resume_{userId}" during resume upload)
  const resumeVector = await index.fetch([`resume_${userId}`], { includeVectors: true });
  if (!resumeVector[0]?.vector) return [];

  const results = await index.query({
    vector: resumeVector[0].vector,
    topK,
    filter: `is_remote = true OR is_remote = false`,  // no filter = all active
    includeMetadata: true,
    includeVectors: false,
  });

  return results.map((r) => ({
    ...r.metadata,
    matchScore: Math.round(r.score * 100),
  }));
}

export function computeSkillGap(userSkills: string[], jobRequiredSkills: string[]) {
  const userSet = new Set(userSkills.map((s) => s.toLowerCase()));
  return {
    matching: jobRequiredSkills.filter((s) => userSet.has(s.toLowerCase())),
    missing:  jobRequiredSkills.filter((s) => !userSet.has(s.toLowerCase())),
  };
}
```

### Step 8.3 — `app/api/jobs/route.ts`

```typescript
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getJobs } from "@/lib/jobs/queries";
import { getMatchedJobs } from "@/lib/jobs/match";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const { searchParams } = req.nextUrl;

  const sort = searchParams.get("sort") ?? "newest";

  if (sort === "match" && userId) {
    const jobs = await getMatchedJobs(userId);
    return NextResponse.json({ jobs });
  }

  const jobs = await getJobs({
    role:       searchParams.get("role")       ?? undefined,
    level:      searchParams.get("level")      ?? undefined,
    work_mode:  searchParams.get("work_mode")  ?? undefined,
    salary_min: searchParams.get("salary_min") ? Number(searchParams.get("salary_min")) : undefined,
    q:          searchParams.get("q")          ?? undefined,
    page:       searchParams.get("page")       ? Number(searchParams.get("page")) : 1,
  });

  return NextResponse.json({ jobs });
}
```

### Step 8.4 — `app/api/jobs/[id]/prepare/route.ts`

```typescript
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getJobById } from "@/lib/jobs/queries";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await getJobById(params.id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Map job fields to interview generation params
  const interviewParams = new URLSearchParams({
    role:        job.role_category,
    level:       job.level !== "Not Specified" ? job.level : "Mid",
    company:     job.company_name,
    techstack:   (JSON.parse(job.required_skills ?? "[]") as string[]).slice(0, 5).join(","),
    source_job:  params.id,   // passed through so feedback can reference the JD
  });

  return NextResponse.json({
    redirect: `/interview?${interviewParams.toString()}`,
  });
}
```

---

## Phase 9 — UI Components

### Step 9.1 — `components/jobs/MatchScoreBar.tsx`

```tsx
interface Props { score: number }

export function MatchScoreBar({ score }: Props) {
  const color = score >= 75 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-semibold w-12 text-right">{score}%</span>
    </div>
  );
}
```

### Step 9.2 — `components/jobs/JobCard.tsx`

```tsx
import Link from "next/link";
import { MatchScoreBar } from "./MatchScoreBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  job: {
    job_id: string; title: string; company_name: string;
    location: string; work_mode: string; salary_raw?: string;
    role_category: string; level: string;
    required_skills: string[]; matchScore?: number;
  };
  onPractice: (jobId: string) => void;
}

export function JobCard({ job, onPractice }: Props) {
  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col gap-3 hover:border-primary/50 transition-colors">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold text-base">{job.title}</p>
          <p className="text-sm text-muted-foreground">{job.company_name} · {job.location}</p>
        </div>
        <Badge variant="outline">{job.work_mode}</Badge>
      </div>

      <div className="flex gap-2 flex-wrap">
        {job.required_skills.slice(0, 4).map((s) => (
          <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
        ))}
      </div>

      {job.matchScore !== undefined && <MatchScoreBar score={job.matchScore} />}

      <div className="flex gap-2 mt-1">
        <Button size="sm" className="flex-1" onClick={() => onPractice(job.job_id)}>
          Practice for this role
        </Button>
        <Link href={`/jobs/${job.job_id}`}>
          <Button size="sm" variant="outline">View</Button>
        </Link>
      </div>
    </div>
  );
}
```

### Step 9.3 — `app/(root)/jobs/page.tsx`

```tsx
"use client";
import { useEffect, useState } from "react";
import { JobCard } from "@/components/jobs/JobCard";
import { useRouter } from "next/navigation";

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [sort, setSort] = useState("match");
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/jobs?sort=${sort}`)
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []));
  }, [sort]);

  async function handlePractice(jobId: string) {
    const res = await fetch(`/api/jobs/${jobId}/prepare`, { method: "POST" });
    const { redirect } = await res.json();
    router.push(redirect);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Find Your Next Role</h1>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm bg-background"
        >
          <option value="match">Best Match</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobs.map((job) => (
          <JobCard key={job.job_id} job={job} onPractice={handlePractice} />
        ))}
      </div>

      {jobs.length === 0 && (
        <p className="text-center text-muted-foreground py-16">
          No jobs found. The pipeline may still be running its first batch.
        </p>
      )}
    </div>
  );
}
```

---

## Phase 10 — Running Everything

### Step 10.1 — First-time setup commands

```bash
# 1. Install Python deps (from /pipeline)
cd pipeline && pip install -r requirements.txt

# 2. Copy env
cp ../.env.local .env
# Add ADZUNA_APP_ID, ADZUNA_APP_KEY, BRONZE_DATA_PATH=./data/bronze

# 3. Start Airflow
docker compose up -d

# 4. Open Airflow UI → http://localhost:8080
# Default credentials: airflow / airflow
# Enable the DAG: job_ingestion_daily
# Trigger manually for first run

# 5. Run the MySQL migration
mysql -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE < migration.sql

# 6. dbt setup (inside /pipeline/transform)
dbt deps
dbt debug    # verify DuckDB connection
```

### Step 10.2 — Manual test run (without Airflow)

```bash
cd pipeline
python -c "
from scrapers.remoteok import RemoteOKScraper
from bronze.writer import write_bronze
jobs = RemoteOKScraper().fetch()
write_bronze(jobs, './data/bronze')
print(f'Wrote {len(jobs)} jobs')
"

# Run dbt
cd transform && dbt run && dbt test

# Check results
python -c "
import duckdb
con = duckdb.connect('../data/hiredfox.duckdb')
print(con.execute('SELECT role_category, count(*) FROM mart_jobs_silver GROUP BY 1').df())
"
```

---

## Checklist Summary

### Phase 1 — Python project scaffolding
- [ ] Create `/pipeline` directory structure
- [ ] Write `requirements.txt`
- [ ] Create `.env` for pipeline

### Phase 2 — Scrapers
- [ ] `base.py` — `RawJob` dataclass + `BaseScraper` ABC
- [ ] `remoteok.py` scraper
- [ ] `adzuna.py` scraper (register free API key at adzuna.com)
- [ ] `hackernews.py` scraper
- [ ] `greenhouse.py` scraper

### Phase 3 — Bronze layer
- [ ] `bronze/writer.py` — atomic Parquet write

### Phase 4 — dbt (Silver)
- [ ] `dbt_project.yml` + `profiles.yml`
- [ ] Staging models × 4 sources
- [ ] `int_jobs_unioned.sql`
- [ ] `int_jobs_normalized.sql`
- [ ] `int_jobs_deduped.sql`
- [ ] `mart_jobs_silver.sql`
- [ ] `schema.yml` with dbt tests

### Phase 5 — Enrichment (Gold)
- [ ] `enrichment/skill_extractor.py`
- [ ] `enrichment/embedder.py`

### Phase 6 — MySQL sync
- [ ] Run migration SQL (4 new tables)
- [ ] `serving/sync_mysql.py`
- [ ] `serving/expire_jobs.py`

### Phase 7 — Airflow
- [ ] `docker-compose.yml`
- [ ] `dags/job_ingestion_daily.py`
- [ ] Verify DAG runs end-to-end manually

### Phase 8 — Next.js API
- [ ] `lib/jobs/queries.ts`
- [ ] `lib/jobs/match.ts`
- [ ] `app/api/jobs/route.ts`
- [ ] `app/api/jobs/[id]/route.ts`
- [ ] `app/api/jobs/[id]/prepare/route.ts`
- [ ] `app/api/jobs/[id]/save/route.ts`

### Phase 9 — UI
- [ ] `MatchScoreBar.tsx`
- [ ] `JobCard.tsx`
- [ ] `app/(root)/jobs/page.tsx`
- [ ] `app/(root)/jobs/[id]/page.tsx`
- [ ] Add "Jobs" link to main nav

### Phase 10 — Insights (Optional, Week 2)
- [ ] `mart_trending_skills.sql` dbt model
- [ ] `mart_salary_benchmarks.sql` dbt model
- [ ] `app/api/jobs/insights/*` routes
- [ ] `app/(root)/jobs/insights/page.tsx` with Recharts
