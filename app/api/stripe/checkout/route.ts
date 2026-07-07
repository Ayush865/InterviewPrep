/**
 * app/api/stripe/checkout/route.ts
 *
 * Legacy alias — checkout now lives at /api/billing/checkout and
 * dispatches to the configured payment provider.
 */

export { POST } from "@/app/api/billing/checkout/route";
