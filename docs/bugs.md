# Bug Fixes and Improvements Plan: AI Mock Interview Platform

**Project:** HiredFox (formerly ai_mock_interviews)
**Type:** Next.js 15 Full-Stack Application
**Database:** MySQL
**Primary Technologies:** Clerk (Auth), Vapi AI (Voice), Google Gemini (AI Generation)

---

## Executive Summary

This document provides a comprehensive plan for fixing **26 identified bugs and security vulnerabilities** and implementing **20+ architectural improvements** in the AI Mock Interview platform. Issues are prioritized by severity and organized into 7 implementation phases spanning approximately 3-4 weeks.

### Critical Statistics
- **2 CRITICAL security issues** requiring immediate action
- **5 HIGH severity bugs** causing potential crashes and data exposure
- **11 MEDIUM priority issues** affecting reliability and performance
- **5 LOW severity** code quality issues
- **3 Configuration/deployment** concerns

---

## Project Architecture Overview

### Technology Stack
- **Frontend:** Next.js 15.5.9 (App Router), React 19, TypeScript, TailwindCSS, shadcn/ui
- **Backend:** Next.js API Routes, MySQL with connection pooling
- **Authentication:** Clerk (webhook-based user sync)
- **AI/Voice:** Vapi AI (voice interviews), Google Gemini 2.5 Flash (question generation)
- **Infrastructure:** Vercel-ready deployment

### Key Application Components
```
/app/api/vapi/
  ├── generate/route.ts      # Generate interview questions (AI)
  ├── webhook/route.ts       # Vapi webhook receiver
  ├── clone/route.ts         # Clone Vapi assistants
  └── link/route.ts          # Link Vapi resources

/app/api/webhooks/clerk/     # Clerk user sync webhook

/lib/
  ├── db.ts                  # MySQL connection pool
  ├── db-queries.ts          # Data access layer (CRUD)
  ├── logger.ts              # File + console logging
  └── crypto.ts              # Credential encryption

/components/
  ├── VapiInterview.tsx      # Live voice interview UI
  └── Agent.tsx              # AI agent interaction
```

### Database Schema (MySQL)
- `users` - User accounts (synced from Clerk)
- `interviews` - Generated interviews with questions
- `feedbacks` - AI-generated performance feedback
- `user_vapi_keys` - Encrypted user API credentials

---

## PHASE 1: CRITICAL SECURITY FIXES (P0 - IMMEDIATE)

**Priority:** Must complete before any other work
**Estimated Time:** 2-3 hours
**Risk Level:** CRITICAL - Active security vulnerabilities

### Issue 1.1: Exposed Production Secrets
**Severity:** CRITICAL
**Impact:** Full account compromise, API abuse, database breach

**Current State:**
- `.env.local` file contains production credentials (likely version controlled)
- `.env.example` contains real production database URL

**Files to Address:**
- `.env.local` (DELETE from git history)
- `.env.example` (SANITIZE all values)
- `.gitignore` (VERIFY includes env files)

**Action Steps:**
1. **Immediately revoke ALL exposed credentials:**
   - Clerk publishable and secret keys
   - Clerk webhook secret
   - Google Gemini API key
   - All Vapi API keys and tokens
   - MySQL database password
   - `MASTER_KEY` (encryption key)

2. **Remove `.env.local` from git history:**
   ```bash
   # Use git-filter-repo or BFG Repo-Cleaner
   git filter-repo --path .env.local --invert-paths
   # WARNING: Coordinate with team before force-pushing
   ```

3. **Sanitize `.env.example`:**
   - Replace all real values with: `YOUR_KEY_HERE` or `changeme`
   - Document which vars are required vs optional

4. **Add environment validation:**
   - Create `/lib/env-validator.ts`
   - Validate required env vars on app startup
   - Fail fast with clear error messages

**Verification:**
- Run `git log --all --full-history -- .env.local` (should return nothing)
- Scan with `trufflehog` or `gitleaks`
- Test app starts with new credentials
- Verify old credentials are revoked in each service

---

### Issue 1.2: CORS Misconfiguration - Allow All Origins
**Severity:** CRITICAL
**Impact:** Cross-site request forgery (CSRF), unauthorized API access

**Current State:**
```typescript
// app/api/vapi/generate/route.ts:11
// app/api/vapi/webhook/route.ts:5
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",  // INSECURE
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
```

**Files to Modify:**
- `app/api/vapi/generate/route.ts`
- `app/api/vapi/webhook/route.ts`
- `app/api/vapi/clone/route.ts`
- `app/api/vapi/link/route.ts`

**Solution:**
1. **Create centralized CORS utility** (`/lib/cors.ts`):
   ```typescript
   export function getCorsHeaders(origin: string | null) {
     const allowed = process.env.ALLOWED_ORIGINS?.split(',') || [];
     if (!origin || !allowed.includes(origin)) {
       return null; // Reject request
     }
     return {
       "Access-Control-Allow-Origin": origin,
       "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
       "Access-Control-Allow-Headers": "Content-Type, Authorization",
     };
   }
   ```

2. **Update all API routes** to use dynamic CORS validation

3. **Add to `.env.example`:**
   ```
   ALLOWED_ORIGINS=https://api.vapi.ai,https://vapi.ai
   ```

**Verification:**
- Test from allowed origins (should succeed)
- Test from random domain (should reject)
- Test OPTIONS preflight (should work)

---

## PHASE 2: HIGH PRIORITY BUG FIXES (P1)

**Estimated Time:** 4-5 hours
**Risk Level:** HIGH - Runtime crashes, data corruption

### Issue 2.1: Non-Null Assertions Without Validation
**Severity:** HIGH
**Files:** `app/(root)/interview/[id]/page.tsx`
**Lines:** 24, 29, 30

**Current Code:**
```typescript
const feedback = await getFeedbackByInterviewId({
  userId: clerkUser?.id!,  // CRASH if clerkUser is null
});
const isPremium = await getUserPremiumStatus(clerkUser?.id!);
const feedbackCount = await getUserFeedbackCount(clerkUser?.id!);
```

**Impact:** "Cannot read property 'id' of null" crash

**Solution:**
1. Add early return with proper user check:
   ```typescript
   if (!clerkUser?.id) {
     redirect("/sign-in");
   }
   ```
2. Create type guard: `lib/type-guards.ts`
3. Remove all `!` non-null assertions

**Verification:**
- Test page access without authentication (should redirect)
- Run TypeScript in strict mode (no errors)

---

### Issue 2.2: Unsafe JSON.parse Operations
**Severity:** HIGH
**Files:** `app/api/vapi/generate/route.ts` (line 136), `app/api/vapi/clone/route.ts`

**Current Code:**
```typescript
// Line 136: No try-catch protection
questions: JSON.parse(questions),
```

**Impact:** Server crash if AI returns malformed JSON

**Solution:**
1. **Create utility** (`/lib/json-utils.ts`):
   ```typescript
   export function safeJsonParse<T>(
     value: string,
     fallback?: T
   ): T | null {
     try {
       return JSON.parse(value) as T;
     } catch (error) {
       logger.error('JSON parse error:', error);
       return fallback ?? null;
     }
   }
   ```

2. **Replace all unprotected JSON.parse calls:**
   - `app/api/vapi/generate/route.ts:136`
   - `app/api/vapi/clone/route.ts` (file reading)
   - Any other occurrences

3. **Add Zod validation** after parsing to verify structure

**Verification:**
- Test with malformed JSON (should return error, not crash)
- Test with valid JSON (should work normally)
- Check error logs capture failures

---

### Issue 2.3: Stack Trace Leakage to Clients
**Severity:** HIGH
**Files:** `app/api/vapi/generate/route.ts` (line 155), `app/api/vapi/webhook/route.ts` (line 113)

**Current Code:**
```typescript
// generate/route.ts:155 - ALWAYS returns stack trace
details: error instanceof Error ? error.stack : String(error)

// webhook/route.ts:113 - Returns in development
stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
```

**Impact:** Exposes internal implementation details, file paths, security vulnerabilities

**Solution:**
1. **Create error utility** (`/lib/api-errors.ts`):
   ```typescript
   export function createErrorResponse(error: unknown, status = 500) {
     const isDev = process.env.NODE_ENV === 'development';
     const message = error instanceof Error
       ? error.message
       : 'Internal server error';

     // Log full error server-side ONLY
     logger.error('API Error:', error);

     // Return sanitized error to client (NO STACK TRACES)
     return NextResponse.json({
       success: false,
       error: isDev ? message : 'An error occurred',
       // Assign error codes for debugging instead
     }, { status });
   }
   ```

2. **Update all API routes** to use `createErrorResponse`
3. **Remove all references** to `error.stack` and `details` fields

**Verification:**
- Trigger errors in production mode (should return generic message)
- Trigger errors in dev (should be descriptive, but NO stack)
- Verify all errors logged server-side

---

### Issue 2.4: Commented-Out Validation
**Severity:** HIGH
**File:** `app/api/vapi/generate/route.ts`
**Lines:** 48-58

**Current Code:**
```typescript
// CRITICAL VALIDATION DISABLED!
// if (!type || !role || !level || !techstack || !amount || !userid || userid === "NULL") {
//   return Response.json({ error: "Missing required fields" }, { status: 400 });
// }
```

**Impact:** Allows invalid data through, potential AI prompt injection

**Solution:**
1. **Re-enable validation** immediately
2. **Enhance with Zod schema** (`/lib/validations/vapi.ts`):
   ```typescript
   export const GenerateInterviewSchema = z.object({
     type: z.enum(['technical', 'behavioral', 'mixed']),
     role: z.string().min(1).max(100),
     level: z.enum(['junior', 'mid', 'senior', 'lead']),
     techstack: z.string().min(1),
     amount: z.coerce.number().min(3).max(15),
     userid: z.string().min(1).refine(val => val !== 'NULL' && val !== 'null'),
   });
   ```
3. **Add input sanitization** (trim, validate format)

**Verification:**
- Test with missing fields (should reject 400)
- Test with userid="NULL" (should reject)
- Test with valid data (should succeed)

---

### Issue 2.5: Type Safety Bypass with 'any'
**Severity:** HIGH
**File:** `app/api/webhooks/clerk/route.ts` (line 60)

**Current Code:**
```typescript
const user = (evt.data as any).user;  // Bypasses type safety
```

**Solution:**
1. Create proper type definitions for Clerk webhook events
2. Add runtime validation for nested properties
3. Use type guards instead of `as any`

---

## PHASE 3: MEDIUM PRIORITY IMPROVEMENTS (P2)

**Estimated Time:** 5-6 hours

### Issue 3.1: Unhandled Promises in useEffect
**Files:** Client components with async useEffect hooks

**Solution:** Wrap async operations in try-catch within useEffect

---

### Issue 3.2: LocalStorage Access Without Error Handling
**Files:** Components accessing localStorage/sessionStorage

**Solution:**
1. Create storage utility (`/lib/storage.ts`)
2. Handle quota exceeded errors
3. Handle SSR context (no localStorage)

---

### Issue 3.3: Database Connection Pool Never Closed
**File:** `lib/db.ts`

**Solution:**
- Add SIGTERM/SIGINT handlers to call `closePool()`
- Prevent orphaned connections in serverless

---

### Issue 3.4: Race Conditions in User Creation
**File:** `lib/db-queries.ts` (getOrCreateUser function)

**Solution:** Use `INSERT ... ON DUPLICATE KEY UPDATE` instead of check-then-insert

---

### Issue 3.5: No Request Rate Limiting
**Impact:** API abuse, unlimited AI generation costs

**Solution:**
1. Implement rate limiting (per IP and per user)
2. Apply to `/api/vapi/generate` endpoint (strictest)
3. Return 429 status when throttled

---

### Issue 3.6: Missing CSRF Protection
**Solution:** Verify Clerk middleware CSRF protection or implement custom tokens

---

## PHASE 4: CODE QUALITY IMPROVEMENTS (P3)

**Estimated Time:** 6-8 hours

### Issue 4.1: Mixed Logging (console.log vs logger)
**Files:** Dozens of files across codebase

**Current State:**
- `webhook/route.ts` uses `console.log` extensively
- Other files use `logger` utility
- Inconsistent log formats

**Solution:**
1. **Search and replace** all `console.log` with `logger.*`
2. **Add ESLint rule:** `"no-console": "error"`
3. **Enhance logger** with request IDs, structured logging (JSON)

**Affected Files:**
- `app/api/vapi/webhook/route.ts` (lines 20, 21, 28, 37, 47, 69, 85, 90, 99, 103)
- `app/(root)/interview/[id]/page.tsx` (lines 35, 47)
- Many others

**Verification:**
- Search codebase for `console.log` (should find none)
- All logs use consistent format

---

### Issue 4.2: Type Safety Gaps (Multiple 'any' Types)
**Files:** Throughout codebase

**Solution:**
1. Enable strict TypeScript in `tsconfig.json`
2. Create proper type definitions for external APIs
3. Replace all `any` with specific types or `unknown`

---

### Issue 4.3: Code Duplication
**Patterns:** Field mapping, parameter extraction repeated

**Solution:**
- Extract common utilities (`/lib/vapi-utils.ts`, `/lib/field-mapping.ts`)
- Reduce duplicate code

---

### Issue 4.4: Re-enable Build Checks
**File:** `next.config.ts` (lines 19-24)

**Current State:**
```typescript
eslint: {
  ignoreDuringBuilds: true,  // DANGEROUS
},
typescript: {
  ignoreBuildErrors: true,   // DANGEROUS
},
```

**Solution:**
1. Fix all TypeScript errors (covered by previous phases)
2. Fix all ESLint errors
3. Set both to `false` to enforce checks
4. Add pre-commit hooks to prevent regressions

**Verification:**
- `npm run build` succeeds with checks enabled
- CI/CD fails on new errors

---

## PHASE 5: PERFORMANCE OPTIMIZATIONS (P3)

**Estimated Time:** 4-5 hours

### Issue 5.1: Conservative Database Pool
**File:** `lib/db.ts`

**Current:** `connectionLimit: 5` (too low for production)

**Solution:** Increase to 10-20 based on load testing

---

### Issue 5.2: N+1 Query Patterns
**Files:** `lib/db-queries.ts`, various components

**Solution:** Use JOINs and batched queries instead of loops

---

### Issue 5.3: Synchronous File Logging
**File:** `lib/logger.ts` (line 89)

**Current:** `fs.appendFileSync()` blocks event loop

**Solution:** Convert to async with write buffering/queue

---

### Issue 5.4: Missing Pagination
**Files:** `lib/db-queries.ts` (getLatestInterviews, getInterviewsByUserId)

**Solution:** Add LIMIT/OFFSET pagination or cursor-based pagination

---

## PHASE 6: ARCHITECTURE IMPROVEMENTS (P4)

**Estimated Time:** 10-12 hours

### Issue 6.1: Missing Service Layer
**Current:** Business logic mixed in route handlers

**Solution:**
- Create `/lib/services/interview-service.ts`
- Create `/lib/services/user-service.ts`
- Extract validation, transformation logic
- Keep route handlers thin

---

### Issue 6.2: No API Response Abstraction
**Current:** Each route builds responses differently

**Solution:**
- Create `/lib/api-response.ts` with `successResponse()`, `errorResponse()`
- Standardize all API responses: `{success, data, error}`

---

### Issue 6.3: No Request Validation Layer
**Current:** Manual validation in each route

**Solution:**
- Create comprehensive Zod schemas for all endpoints
- Build validation middleware: `validateRequest(schema)`
- Apply to all routes

---

### Issue 6.4: No Webhook Idempotency
**Current:** Duplicate webhooks may cause double-processing

**Solution:**
- Store webhook event IDs in database
- Check before processing
- Return cached response for duplicates

---

## PHASE 7: TESTING INFRASTRUCTURE (P4)

**Estimated Time:** 15-20 hours

### Issue 7.1: Minimal Test Coverage
**Current State:**
- Only 3 test files: `crypto.test.ts`, `sanitize.test.ts`, `version.test.ts`
- No API route tests
- No integration tests

**Solution:**
1. **Add API integration tests:**
   - `__tests__/api/vapi/generate.test.ts`
   - `__tests__/api/webhooks/clerk.test.ts`
   - Test happy paths, error cases, edge cases

2. **Add unit tests for services:**
   - `__tests__/lib/db-queries.test.ts` (target 90% coverage)
   - Mock MySQL pool
   - Test all CRUD operations

3. **Setup test infrastructure:**
   - Configure Jest (already in package.json)
   - Setup test database
   - Mock external services (Clerk, Vapi, Gemini)

**Target:** 80% overall code coverage

---

## Critical Files Summary

These files require the most attention:

| Priority | File Path | Issues | Phase |
|----------|-----------|--------|-------|
| P0 | `.env.local` | Exposed secrets | 1 |
| P0 | `app/api/vapi/generate/route.ts` | CORS, JSON parse, stack leak, validation | 1-2 |
| P0 | `app/api/vapi/webhook/route.ts` | CORS, stack leak, console.log | 1-2 |
| P1 | `app/(root)/interview/[id]/page.tsx` | Non-null assertions | 2 |
| P1 | `next.config.ts` | Build checks disabled | 4 |
| P2 | `lib/db.ts` | Connection pool, graceful shutdown | 3, 5 |
| P2 | `lib/logger.ts` | Sync file I/O | 4, 5 |
| P2 | `lib/db-queries.ts` | Race conditions, N+1 queries | 3, 5 |

---

## Implementation Guidelines

### Development Workflow
1. **Create feature branch** for each phase
2. **Fix issues** in order within each phase
3. **Write tests** alongside fixes (after Phase 7 setup)
4. **Code review** checklist for each PR
5. **Test on staging** before production

### Risk Mitigation
- **Git tags** before each phase
- **Database backups** before schema changes
- **Feature flags** for major changes
- **Staged rollout** to production

### Verification Strategy
**Per-Phase:**
- Manual testing of affected features
- Regression testing
- Security scanning (Phase 1)
- Performance benchmarking (Phase 5)

**Final:**
- Full regression suite
- Security audit
- Load testing
- UAT

---

## Success Metrics

### Phase 1 (Security) - REQUIRED
- ✅ Zero secrets in git history
- ✅ CORS restricted to allowed origins only
- ✅ All credentials rotated

### Phase 2 (Bugs) - REQUIRED
- ✅ Zero runtime crashes from type assertions
- ✅ Zero JSON.parse failures
- ✅ Zero stack traces leaked

### Phase 3-4 (Quality)
- ✅ 100% of code uses logger (no console.log)
- ✅ <5% usage of 'any' type
- ✅ Build checks enabled and passing

### Phase 5 (Performance)
- ✅ <100ms p50 API response time
- ✅ <500ms p95 API response time
- ✅ DB pool utilization <80%

### Phase 6-7 (Architecture & Testing)
- ✅ >80% code coverage
- ✅ All business logic in services
- ✅ All endpoints validated with Zod

---

## Appendix A: Quick Reference

### Environment Variables to Add
```env
ALLOWED_ORIGINS=https://api.vapi.ai,https://vapi.ai
NODE_ENV=production
```

### New Files to Create
- `/lib/env-validator.ts` - Env var validation
- `/lib/cors.ts` - CORS utility
- `/lib/json-utils.ts` - Safe JSON parsing
- `/lib/api-errors.ts` - Error response utility
- `/lib/type-guards.ts` - TypeScript type guards
- `/lib/validations/vapi.ts` - Zod schemas
- `/lib/storage.ts` - LocalStorage wrapper
- `/lib/api-response.ts` - Response builders
- `/lib/services/interview-service.ts` - Business logic
- `/lib/services/user-service.ts` - User operations

### Commands
```bash
# Remove secrets from git history
git filter-repo --path .env.local --invert-paths

# Scan for exposed secrets
trufflehog git file://. --only-verified

# Search for security issues
grep -r "console.log" app/
grep -r "as any" app/
grep -r "JSON.parse" app/

# Run tests with coverage
npm test -- --coverage

# Build with checks enabled
npm run build
```

---

## Appendix B: Testing Checklist

### Manual Testing After Phase 1-2
- [ ] User signup flow
- [ ] Interview generation (authenticated)
- [ ] Live voice interview
- [ ] Feedback generation
- [ ] Premium feature access
- [ ] Error scenarios (network failures, invalid input)

### Automated Testing After Phase 7
- [ ] Unit tests pass (>80% coverage)
- [ ] Integration tests pass
- [ ] API contract tests pass
- [ ] Security scanning clean
- [ ] Performance benchmarks meet targets

---

## Next Steps for Implementation

1. **Review this plan** with team/stakeholders
2. **Prioritize phases** based on business needs
3. **Allocate resources** (1-2 developers, 3-4 weeks)
4. **Setup tracking** (Jira, GitHub Projects, etc.)
5. **Begin Phase 1** immediately (security critical)
6. **Schedule reviews** at end of each phase

---

**End of Plan Document**

*This plan can be provided to AI agents or developers for systematic implementation. Each phase is self-contained with clear objectives, verification steps, and success criteria.*
