/**
 * lib/feature-flags.ts
 *
 * Environment-driven feature flags. NEXT_PUBLIC_ vars are inlined at
 * build time, so these helpers work in both server and client code.
 */

/**
 * Bring-your-own-key Vapi credentials.
 *
 * Set NEXT_PUBLIC_ENABLE_VAPI_BYOK=false to hide every Vapi-key surface:
 * the navbar settings link, the /settings/vapi page, and all
 * "use my own Vapi key" options in limit modals, gates, and billing.
 * Defaults to enabled.
 *
 * Note: users who linked credentials before the flag was turned off keep
 * their unlimited access — the flag hides the UI for adding/managing
 * keys, it does not revoke existing ones.
 */
export function isVapiByokEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_VAPI_BYOK !== "false";
}
