'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';

export default function SyncUserPage() {
  const { user, isLoaded } = useUser();
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const syncUser = async () => {
    setLoading(true);
    setStatus('Syncing...');

    try {
      const response = await fetch('/api/sync-user', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(`✅ Success: ${data.message}`);
      } else {
        setStatus(`❌ Error: ${data.error}`);
      }
    } catch (error: any) {
      setStatus(`❌ Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return <div className="p-8">Loading...</div>;
  }

  if (!user) {
    return <div className="p-8">Please sign in first</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Sync User to Database</h1>

        <div className="mb-4 p-4 bg-blue-50 rounded">
          <p className="text-sm text-gray-700">
            <strong>Logged in as:</strong>
          </p>
          <p className="text-sm font-mono mt-1">{user.id}</p>
          <p className="text-sm">{user.primaryEmailAddress?.emailAddress}</p>
        </div>

        <button
          onClick={syncUser}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Syncing...' : 'Sync to MySQL'}
        </button>

        {status && (
          <div className="mt-4 p-3 bg-gray-50 rounded">
            <p className="text-sm whitespace-pre-wrap">{status}</p>
          </div>
        )}

        <div className="mt-6 p-4 bg-yellow-50 rounded text-sm">
          <p className="font-semibold mb-2">ℹ️ When to use this:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>You're already logged in but not in the database</li>
            <li>The Clerk webhook failed to create your user</li>
            <li>You need to manually sync your account</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
