# Plan: Resume Upload + Company-Targeted Interview Generation

## Context

The app currently generates mock interviews based on role, level, tech stack, and type — with no company awareness and randomly assigned cover images. This plan adds:

1. **Resume upload** — parse, embed, and store user's resume in a vector DB (Upstash Vector) + raw text in MySQL
2. **Company selection** — user picks a target company; its logo becomes the interview card cover
3. **Resume-aware Gemini prompt** — when generating from resume, Gemini receives the full resume context (work experience, skills, projects) + target company to produce highly personalized interview questions
4. **Updated Gemini prompt** — includes company name + optionally full resume context

---

## Vector DB Choice: Upstash Vector

**Reasoning:** This is a Next.js project likely deployed on Vercel (serverless). Upstash Vector uses a pure HTTP API — no persistent connections, no connection pooling issues, works in Node.js and Edge runtimes.

- **Free tier:** 10K vectors, 10K queries/day — sufficient for resume storage per user
- **Serverless-native:** Perfect for Vercel/Next.js App Router
- **Simple SDK:** `@upstash/vector` with `index.upsert()` / `index.query()` / `index.fetch()`
- **Embedding model:** Use Google's `text-embedding-004` (free via Gemini API) to generate vectors from resume text, then store in Upstash

**Storage strategy:**
- **MySQL `user_resumes`** — stores raw extracted text + Gemini-parsed structured fields (role, level, skills, summary). This is the primary data store.
- **Upstash Vector** — stores the resume embedding with `user_id` as the vector ID and the raw text + parsed fields as metadata. Used for semantic retrieval when generating interview questions.

When generating from resume, we fetch the vector from Upstash by `user_id` to get the resume metadata (no SQL needed at generation time).

---

## New npm Packages

```bash
npm install pdf-parse mammoth @upstash/vector
npm install --save-dev @types/pdf-parse
```

- `pdf-parse` — extract text from PDF resumes
- `mammoth` — extract text from DOCX resumes
- `@upstash/vector` — Upstash Vector client

---

## New Environment Variables

```
UPSTASH_VECTOR_REST_URL=
UPSTASH_VECTOR_REST_TOKEN=
```

---

## Phase 1: Database Changes

### 1a. Add `company_name` to `interviews`

```sql
-- db/migrations/001_add_company_name.sql
ALTER TABLE interviews
  ADD COLUMN company_name VARCHAR(255) DEFAULT NULL AFTER cover_image;
```

### 1b. Create `user_resumes` table (MySQL — primary text store)

```sql
-- db/migrations/002_create_user_resumes.sql
CREATE TABLE IF NOT EXISTS user_resumes (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  user_id         VARCHAR(255)  NOT NULL,
  raw_text        LONGTEXT      NOT NULL,
  parsed_role     VARCHAR(255)  DEFAULT NULL,
  parsed_level    VARCHAR(100)  DEFAULT NULL,
  parsed_skills   JSON          DEFAULT NULL,
  parsed_summary  TEXT          DEFAULT NULL,
  file_name       VARCHAR(255)  DEFAULT NULL,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_resume (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

One row per user — upserted via `INSERT ... ON DUPLICATE KEY UPDATE` on re-upload.

---

## Phase 2: Constants & Utils

### Modify: `constants/index.ts`

Add two exports:

```typescript
export const companyToLogo: Record<string, string> = {
  "adobe": "/covers/Adobe.svg", "amazon": "/covers/Amazon.svg",
  "apple": "/covers/Apple.svg", "atlassian": "/covers/Atlassian.svg",
  "dell": "/covers/Dell.svg", "google": "/covers/Google.svg",
  "linkedin": "/covers/LinkedIn.svg", "meta": "/covers/Meta.svg",
  "microsoft": "/covers/Microsoft.svg", "netflix": "/covers/Netflix.png",
  "nvidia": "/covers/Nvidia.svg", "paypal": "/covers/Paypal.svg",
  "salesforce": "/covers/Salesforce.svg", "spotify": "/covers/Spotify.svg",
  "stripe": "/covers/Stripe.svg", "tesla": "/covers/Tesla.svg",
  "twitter": "/covers/Twitter.svg", "uber": "/covers/Uber.svg", "x": "/covers/X.svg",
};

export const interviewCompanies = [
  { value: "adobe", label: "Adobe" }, { value: "amazon", label: "Amazon" },
  { value: "apple", label: "Apple" }, { value: "atlassian", label: "Atlassian" },
  { value: "dell", label: "Dell" }, { value: "google", label: "Google" },
  { value: "linkedin", label: "LinkedIn" }, { value: "meta", label: "Meta" },
  { value: "microsoft", label: "Microsoft" }, { value: "netflix", label: "Netflix" },
  { value: "nvidia", label: "Nvidia" }, { value: "paypal", label: "PayPal" },
  { value: "salesforce", label: "Salesforce" }, { value: "spotify", label: "Spotify" },
  { value: "stripe", label: "Stripe" }, { value: "tesla", label: "Tesla" },
  { value: "twitter", label: "Twitter" }, { value: "uber", label: "Uber" },
  { value: "x", label: "X" },
];
```

### Modify: `lib/utils.ts`

```typescript
export function getLogoForCompany(companyName?: string | null): string {
  if (companyName) {
    const logo = companyToLogo[companyName.toLowerCase()];
    if (logo) return logo;
  }
  return getRandomInterviewCover(); // existing fallback
}
```

---

## Phase 3: Data Layer

### Modify: `lib/db-queries.ts`

**Update `Interview` interface** — add `company_name: string | null`

**Update `createInterview`** — accept optional `company_name?: string` and include in INSERT

**Add `UserResume` interface + two functions:**

```typescript
export interface UserResume {
  id: string; user_id: string; raw_text: string;
  parsed_role: string | null; parsed_level: string | null;
  parsed_skills: string[] | null; parsed_summary: string | null;
  file_name: string | null; created_at: Date; updated_at: Date;
}

async function upsertUserResume(data: Omit<UserResume, 'id' | 'created_at' | 'updated_at'>): Promise<UserResume>
async function getUserResumeByUserId(userId: string): Promise<UserResume | null>
```

### Create: `lib/vector-store.ts`

Upstash Vector client + helper functions:

```typescript
import { Index } from "@upstash/vector";

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});

// Upsert resume vector (called after parsing)
export async function upsertResumeVector(userId: string, embedding: number[], metadata: {
  raw_text: string; parsed_role: string | null;
  parsed_level: string | null; parsed_skills: string[];
  parsed_summary: string | null; file_name: string | null;
}): Promise<void>

// Fetch resume metadata by userId (used during interview generation)
export async function getResumeVector(userId: string): Promise<{
  raw_text: string; parsed_role: string | null;
  parsed_level: string | null; parsed_skills: string[];
  parsed_summary: string | null;
} | null>
```

**Embedding:** Use `@ai-sdk/google` with `google.textEmbeddingModel("text-embedding-004")` to generate the vector from the resume raw text before storing in Upstash.

---

## Phase 4: Resume Upload API

### Create: `app/api/resume/upload/route.ts`

```typescript
export const runtime = 'nodejs'; // pdf-parse requires Node.js runtime

export async function POST(request: Request): Promise<Response> {
  // 1. Parse multipart FormData: file (PDF|DOCX), userid
  // 2. Detect type → pdf-parse or mammoth → rawText: string
  // 3. Gemini extraction prompt → { role, experience_level, skills[], summary }
  // 4. Generate embedding: embed(google.textEmbeddingModel("text-embedding-004"), rawText)
  // 5. upsertResumeVector(userId, embedding, { rawText, parsedFields })  ← Upstash
  // 6. upsertUserResume({ user_id, raw_text, parsedFields, file_name })   ← MySQL
  // 7. Return { success: true, resume: parsedData }
}
```

**Gemini extraction prompt:**
```
You are a resume parser. Extract structured information from the resume text below.
Return ONLY a valid JSON object with these exact fields:
{
  "role": "candidate's current or target job title",
  "experience_level": "one of: junior, mid, senior",
  "skills": ["array", "of", "technical", "skills"],
  "summary": "2-3 sentence professional summary"
}

Resume text:
<RAW_TEXT>
```

### Create: `lib/actions/resume.action.ts`

Server action wrapping `getUserResumeByUserId` for client consumption (camelCase fields).

---

## Phase 5: Form Validation Update

### Modify: `lib/validations/interview.ts`

```typescript
company_name: z.string().optional(),
use_resume: z.boolean().optional(), // whether to pass resume context to Gemini
```

---

## Phase 6: UI Components

### Create: `components/resume/ResumeUploadSection.tsx`

- Shown on dashboard when user is logged in
- Accepts PDF/DOCX (≤5MB), shows file name + upload date after success
- Calls `POST /api/resume/upload` with FormData
- Shows "Resume uploaded ✓ — [filename]" with re-upload button

### Create: `components/interview/CompanySelect.tsx`

- Searchable select showing company name + logo thumbnail per option
- Optional — includes "No specific company" default
- Returns company `value` string (e.g. `"google"`)

### Modify: `components/interview/InterviewForm.tsx`

Two additions:

1. **Company Select** (after Type field, before Techstack):
   - Uses `CompanySelect`
   - Optional, passes `company_name` in submit body

2. **"Generate from Resume" toggle** (shown only if `resumeData` prop exists):
   - When toggled ON: sets `use_resume: true` in submit body and pre-fills role/level/techstack as a visual hint (editable)
   - When toggled OFF: normal generation
   - Toggling ON signals the backend to include **full resume context** in the Gemini prompt — not just field prefill

Update `onSubmit` to include `company_name` and `use_resume` in the fetch body.

---

## Phase 7: Interview Generation API Update

### Modify: `app/api/vapi/generate/route.ts`

```typescript
// Fetch resume context from Upstash if use_resume === true
let resumeContext = "";
if (use_resume) {
  const resumeData = await getResumeVector(userid);
  if (resumeData) {
    resumeContext = `
The candidate has provided their resume. Here is their background:
- Current/Target Role: ${resumeData.parsed_role}
- Experience Level: ${resumeData.parsed_level}
- Skills: ${resumeData.parsed_skills?.join(", ")}
- Professional Summary: ${resumeData.parsed_summary}
- Full Resume Text:
${resumeData.raw_text}

Generate questions that are specifically tailored to this candidate's background,
addressing gaps, strengths, and relevant experience from their resume.
`;
  }
}

// Company context in prompt
const companyContext = company_name
  ? `The interview is for a position at ${company_name}.
     Generate questions that reflect ${company_name}'s known interview style, values,
     and the latest question patterns for a ${level}-level ${role} at ${company_name}.`
  : `Generate high-quality industry-standard interview questions.`;
```

- Replace `getRandomInterviewCover()` with `getLogoForCompany(company_name)`
- Pass `company_name` to `createInterview`

---

## Phase 8: Data Mapping + Page Integration

### Modify: `lib/actions/general.action.ts`

Add `companyName: interview.company_name ?? null` in all interview row mappers.

### Modify: `app/(root)/page.tsx`

Add `<ResumeUploadSection userId={userId} />` in the authenticated section.

### Modify: `app/(root)/interview/page.tsx`

Fetch resume server-side, pass as prop to `<InterviewForm resumeData={resume} />`.

---

## File Change Summary

| File | Action | Key Change |
|------|--------|------------|
| `db/complete-schema.sql` | Modify | Append company_name + user_resumes DDL |
| `db/migrations/001_add_company_name.sql` | Create | ALTER TABLE interviews ADD company_name |
| `db/migrations/002_create_user_resumes.sql` | Create | CREATE TABLE user_resumes |
| `constants/index.ts` | Modify | Add companyToLogo + interviewCompanies |
| `lib/utils.ts` | Modify | Add getLogoForCompany() |
| `lib/db-queries.ts` | Modify | company_name in Interview; UserResume type + upsert/get |
| `lib/vector-store.ts` | Create | Upstash Vector client + upsertResumeVector + getResumeVector |
| `lib/validations/interview.ts` | Modify | Add optional company_name + use_resume fields |
| `lib/actions/resume.action.ts` | Create | Server action wrapping getUserResumeByUserId |
| `lib/actions/general.action.ts` | Modify | Map company_name in interview row mappers |
| `app/api/resume/upload/route.ts` | Create | Parse PDF/DOCX → Gemini extract → embed → Upstash + MySQL |
| `app/api/vapi/generate/route.ts` | Modify | Add company_name + use_resume; full resume context in prompt |
| `components/resume/ResumeUploadSection.tsx` | Create | Upload UI with status indicator |
| `components/interview/CompanySelect.tsx` | Create | Searchable company dropdown with logos |
| `components/interview/InterviewForm.tsx` | Modify | Add company select + resume toggle (signals use_resume) |
| `app/(root)/page.tsx` | Modify | Add ResumeUploadSection in auth'd section |
| `app/(root)/interview/page.tsx` | Modify | Fetch resume server-side + pass to InterviewForm |

---

## Verification Steps

1. **Resume upload:** Upload a PDF → check MySQL `user_resumes` for parsed data; check Upstash Vector console for the stored vector with user_id
2. **Resume-aware generation:** Toggle "Generate from Resume" ON + pick Google + submit → inspect server logs to confirm full resume context is in the Gemini prompt → verify generated questions reference candidate background
3. **Company logo:** Select "Google" → generate → DB: `company_name = "google"`, `cover_image = "/covers/Google.svg"` → interview card shows Google logo
4. **No resume toggle:** Standard generation without resume toggle → Gemini receives only role/level/type/techstack/company as before
5. **Re-upload resume:** Upload second resume → verify MySQL row updated, Upstash vector upserted (same user_id key)
6. **Old interviews:** Existing interviews without `company_name` still render with their existing `cover_image` (no regressions)
