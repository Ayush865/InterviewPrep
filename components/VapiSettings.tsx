/**
 * components/VapiSettings.tsx
 *
 * UI component for users to link their Vapi API key and clone resources.
 */

'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { LinkPreview } from './ui/link-preview';
import { saveUserVapiCredentials } from '@/lib/actions/vapi.action';

interface CloneResult {
  assistantId: string;
  toolId: string;
  actions: string[];
}

export function VapiSettings() {
  const { user } = useUser();
  const [apiKey, setApiKey] = useState('');
  const [webToken, setWebToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cloneResult, setCloneResult] = useState<CloneResult | null>(null);

  const handleLinkAndClone = async () => {
    if (!user) {
      setError('Please sign in first');
      return;
    }

    if (!apiKey.trim()) {
      setError('Please enter your Vapi Private API key');
      return;
    }

    if (!webToken.trim()) {
      setError('Please enter your Vapi Public Web Token');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Step 1: Link the API key
      console.log('Linking Vapi API key...');
      const linkResponse = await fetch('/api/vapi/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          apiKey: apiKey.trim(),
        }),
      });

      if (!linkResponse.ok) {
        const linkError = await linkResponse.json();
        throw new Error(linkError.error || 'Failed to link API key');
      }

      const linkData = await linkResponse.json();
      console.log('API key linked:', linkData);

      // Step 2: Clone assistant and tool
      console.log('Cloning assistant and tool...');
      const cloneResponse = await fetch('/api/vapi/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
        }),
      });

      if (!cloneResponse.ok) {
        const cloneError = await cloneResponse.json();
        throw new Error(cloneError.error || 'Failed to clone resources');
      }

      const cloneData: CloneResult = await cloneResponse.json();
      console.log('Clone result:', cloneData);

      // Step 3: Save to database (Firebase)
      console.log('Saving credentials to database...');
      const dbResult = await saveUserVapiCredentials(user.id, {
        webToken: webToken.trim(),
        assistantId: cloneData.assistantId,
        toolId: cloneData.toolId,
      });

      if (!dbResult.success) {
        console.error('Failed to save to database:', dbResult.error);
        throw new Error(dbResult.error || 'Failed to save credentials to database');
      }

      console.log('✅ Credentials saved to database successfully');

      // Save to localStorage for quick access (fallback)
      localStorage.setItem('vapi_assistant_id', cloneData.assistantId);
      localStorage.setItem('vapi_tool_id', cloneData.toolId);
      localStorage.setItem('vapi_web_token', webToken.trim()); // Use web token for SDK calls
      localStorage.setItem('vapi_user_id', user.id); // Store user ID to prevent cross-user data access

      setCloneResult(cloneData);
      setSuccess(
        `Successfully cloned and saved! Your personal assistant ID: ${cloneData.assistantId}`
      );
      setApiKey(''); // Clear the inputs for security
      setWebToken('');

    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/10">
        <h2 className="text-2xl font-bold mb-4 text-white">Vapi Configuration</h2>
        <p className="text-gray-300 mb-6">
          Link your personal Vapi API key to get your own interview assistant.
        </p>

        <div className="space-y-4">
          {/* Private API Key Input */}
          <div>
            <label
              htmlFor="apiKey"
              className="block text-sm font-medium mb-2 text-white"
            >
              Vapi Private API Key
            </label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your private API key (for cloning)"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-orange focus:border-transparent text-white placeholder-gray-400 transition-all"
              disabled={loading}
            />
            <p className="text-xs text-gray-400 mt-2">
              Used for cloning assistant and tool to your account
            </p>
          </div>

          {/* Public Web Token Input */}
          <div>
            <label
              htmlFor="webToken"
              className="block text-sm font-medium mb-2 text-white"
            >
              Vapi Public Web Token
            </label>
            <input
              id="webToken"
              type="password"
              value={webToken}
              onChange={(e) => setWebToken(e.target.value)}
              placeholder="Enter your public web token (for making calls)"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-orange focus:border-transparent text-white placeholder-gray-400 transition-all"
              disabled={loading}
            />
            <div className="text-xs text-gray-400 mt-2">
              Used for making voice calls. Get both keys from{' '}
              <LinkPreview
                url="https://dashboard.vapi.ai/org/api-keys"
                className="text-orange hover:underline transition-colors"
                isStatic={true}
                imageSrc="/vapi_dashboard.png"
              >
                Vapi Dashboard
              </LinkPreview>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleLinkAndClone}
            disabled={loading || !apiKey.trim() || !webToken.trim()}
            className="w-full px-6 py-4 bg-orange text-white rounded-lg hover:bg-orange/90 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all font-semibold text-lg shadow-lg hover:shadow-orange/50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Processing...
              </span>
            ) : (
              'Link API Key & Clone Assistant'
            )}
          </button>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-500/20 backdrop-blur-sm border border-red-500/50 rounded-lg">
              <p className="text-red-200">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-4 bg-green-500/20 backdrop-blur-sm border border-green-500/50 rounded-lg">
              <p className="text-green-200">{success}</p>
            </div>
          )}

          {/* Clone Result */}
          {cloneResult && (
            <div className="p-5 bg-blue-500/10 backdrop-blur-sm border border-blue-500/30 rounded-lg space-y-3">
              <h3 className="font-semibold text-blue-300 text-lg">
                Clone Details:
              </h3>
              <div className="text-sm space-y-2 text-blue-200">
                <p>
                  <strong className="text-white">Assistant ID:</strong>{' '}
                  <code className="bg-white/10 px-3 py-1 rounded text-blue-300 font-mono">
                    {cloneResult.assistantId}
                  </code>
                </p>
                <p>
                  <strong className="text-white">Tool ID:</strong>{' '}
                  <code className="bg-white/10 px-3 py-1 rounded text-blue-300 font-mono">
                    {cloneResult.toolId}
                  </code>
                </p>
                <details className="mt-3">
                  <summary className="cursor-pointer hover:underline text-blue-300">
                    View Actions ({cloneResult.actions.length})
                  </summary>
                  <ul className="mt-2 space-y-1 ml-4 list-disc text-gray-300">
                    {cloneResult.actions.map((action, idx) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
        <h3 className="font-semibold mb-4 text-white text-xl">How it works:</h3>
        <ol className="list-decimal list-inside space-y-3 text-sm text-gray-300">
          <li>Get both keys from your Vapi Dashboard → API Keys section</li>
          <li>Enter your <strong className="text-white">Private API Key</strong> (for server operations)</li>
          <li>Enter your <strong className="text-white">Public Web Token</strong> (for voice calls)</li>
          <li>Click the button to validate and link your keys</li>
          <li>
            The system will automatically clone the interview assistant and tool
            to your account
          </li>
          <li>
            Your personalized assistant will be used for all future interview
            calls
          </li>
          <li className="text-orange font-medium">All billing will be on your Vapi account</li>
        </ol>
      </div>
    </div>
  );
}
