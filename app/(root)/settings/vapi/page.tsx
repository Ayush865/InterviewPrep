/**
 * app/(root)/settings/vapi/page.tsx
 *
 * Settings page for Vapi configuration.
 */

import { VapiSettings } from "@/components/VapiSettings";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function VapiSettingsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="mx-auto w-full max-w-2xl pb-24 pt-12 max-sm:pt-8">
      <header>
        <h1 className="display text-3xl">Vapi settings</h1>
        <p className="mt-2 text-soft">
          Connect your own Vapi API key for unlimited interview calls, billed
          to your account.
        </p>
      </header>

      <div className="mt-10">
        <VapiSettings />
      </div>
    </div>
  );
}
