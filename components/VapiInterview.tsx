/**
 * components/VapiInterview.tsx
 *
 * Component for starting Vapi interview calls.
 * Automatically uses the user's custom assistant if configured.
 */

'use client';

import { useEffect, useState } from 'react';
import { useVapiAssistant } from '@/hooks/useVapiAssistant';

// Import Vapi SDK
// Make sure you have @vapi-ai/web installed: npm install @vapi-ai/web
declare global {
  interface Window {
    vapiInstance?: any;
  }
}

export function VapiInterview() {
  const { assistantId, apiKey, isCustom, isLoading } = useVapiAssistant();
  const [vapi, setVapi] = useState<any>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState<string>('');

  // Initialize Vapi
  useEffect(() => {
    if (isLoading || !apiKey) return;

    const initVapi = async () => {
      try {
        // Dynamically import Vapi to avoid SSR issues
        const Vapi = (await import('@vapi-ai/web')).default;

        const vapiInstance = new Vapi(apiKey);

        // Set up event listeners
        vapiInstance.on('call-start', () => {
          console.log('Call started');
          setIsCallActive(true);
          setCallStatus('Call in progress...');
        });

        vapiInstance.on('call-end', () => {
          console.log('Call ended');
          setIsCallActive(false);
          setCallStatus('Call ended');
        });

        vapiInstance.on('speech-start', () => {
          console.log('Assistant started speaking');
          setCallStatus('Assistant speaking...');
        });

        vapiInstance.on('speech-end', () => {
          console.log('Assistant stopped speaking');
          setCallStatus('Listening...');
        });

        vapiInstance.on('error', (error: any) => {
          console.error('Vapi error:', error);
          setCallStatus(`Error: ${error.message}`);
        });

        setVapi(vapiInstance);
        window.vapiInstance = vapiInstance;
      } catch (error) {
        console.error('Failed to initialize Vapi:', error);
      }
    };

    initVapi();

    // Cleanup
    return () => {
      if (vapi) {
        vapi.stop();
      }
    };
  }, [apiKey, isLoading]);

  // Log VAPI credentials on page load
  useEffect(() => {
    if (isLoading) return;

    console.log("=== VAPI CREDENTIALS PAGE LOAD (VapiInterview) ===");
    console.log("🔑 VAPI CREDENTIALS CHECK:");
    console.log("  ├─ Using:", isCustom ? "USER'S VAPI CREDENTIALS" : "MASTER/DEFAULT VAPI CREDENTIALS");
    console.log("  ├─ API Key (Web Token):", apiKey ? `${apiKey.substring(0, 15)}...${apiKey.substring(apiKey.length - 4)}` : "No API key");
    console.log("  ├─ Full API Key:", apiKey);
    console.log("  ├─ Assistant ID:", assistantId);
    console.log("  └─ Is Custom:", isCustom);
    console.log("==================================================");
  }, [isLoading, isCustom, apiKey, assistantId]);

  const startCall = async () => {
    if (!vapi || !assistantId) {
      alert('Vapi not initialized or assistant ID missing');
      return;
    }

    try {
      console.log("=== STARTING VAPI CALL ===");
      console.log("📞 Starting call with assistant:", assistantId);
      console.log("==========================");

      await vapi.start(assistantId);
      console.log('✅ Call started successfully');
    } catch (error) {
      console.error('❌ Failed to start call:', error);
      alert('Failed to start call. Please check console for details.');
    }
  };

  const endCall = () => {
    if (vapi) {
      vapi.stop();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading Vapi configuration...</div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="space-y-4">
        {/* Assistant Info */}
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">
            {isCustom ? 'Your Personal Assistant' : 'Default Assistant'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            {assistantId}
          </p>
          {isCustom && (
            <span className="inline-block mt-2 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded-full">
              Using your API key
            </span>
          )}
        </div>

        {/* Call Controls */}
        <div className="flex flex-col gap-3">
          {!isCallActive ? (
            <button
              onClick={startCall}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              Start Interview
            </button>
          ) : (
            <button
              onClick={endCall}
              className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
                />
              </svg>
              End Interview
            </button>
          )}
        </div>

        {/* Status */}
        {callStatus && (
          <div className="text-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {callStatus}
            </p>
          </div>
        )}

        {/* Config Notice */}
        {!isCustom && (
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              Using default assistant. Link your own Vapi API key in settings
              for personalized billing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
