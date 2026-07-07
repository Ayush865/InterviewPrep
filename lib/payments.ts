/**
 * lib/payments.ts
 *
 * Payment provider selection. Razorpay is the default for Indian
 * merchants (Stripe does not onboard businesses in India).
 *
 * Selection order:
 *  1. PAYMENT_PROVIDER env var ("razorpay" | "stripe") if set
 *  2. "razorpay" if RAZORPAY_KEY_ID is configured
 *  3. "stripe" if STRIPE_SECRET_KEY is configured
 *  4. "razorpay" (default)
 */

export type PaymentProvider = "razorpay" | "stripe";

export function getPaymentProvider(): PaymentProvider {
  const explicit = process.env.PAYMENT_PROVIDER?.toLowerCase();
  if (explicit === "razorpay" || explicit === "stripe") {
    return explicit;
  }
  if (process.env.RAZORPAY_KEY_ID) return "razorpay";
  if (process.env.STRIPE_SECRET_KEY) return "stripe";
  return "razorpay";
}
