/**
 * app/settings/vapi/page.tsx
 *
 * Settings page for Vapi configuration.
 */

import { VapiSettings } from '@/components/VapiSettings';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { SparklesCore } from '@/components/ui/sparkles';

export default async function VapiSettingsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden py-12">
      {/* Sparkles Background */}
      <div className="w-full absolute inset-0 h-full">
        <SparklesCore
          id="vapi-settings-sparkles"
          background="transparent"
          minSize={0.6}
          maxSize={1.4}
          particleDensity={10}
          className="w-full h-full"
          particleColor="#FFFFFF"
          speed={5}
        />
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 relative z-10">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-3 text-white">
            Vapi <span className="text-orange">Settings</span>
          </h1>
          <p className="text-gray-300 text-lg">
            Configure your personal Vapi API key for unlimited interview calls
          </p>
        </div>

        <VapiSettings />
      </div>
    </div>
  );
}
