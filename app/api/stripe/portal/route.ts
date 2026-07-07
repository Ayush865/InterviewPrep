/**
 * app/api/stripe/portal/route.ts
 *
 * Legacy alias — subscription management now lives at
 * /api/billing/manage and dispatches to the configured provider.
 */

export { POST } from "@/app/api/billing/manage/route";
