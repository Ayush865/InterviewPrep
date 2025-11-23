/**
 * hooks/useVapiAssistant.ts
 *
 * Custom hook to manage Vapi assistant configuration.
 * Fetches user's credentials from database first, then falls back to localStorage,
 * and finally to default values.
 */

'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { getUserVapiCredentials } from '@/lib/actions/vapi.action';

interface VapiConfig {
  assistantId: string;
  toolId: string | null;
  apiKey: string | null; // This is the public web token for Vapi Web SDK
  isCustom: boolean;
}

const FALLBACK_ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || '';
const FALLBACK_API_KEY = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN || '';

export function useVapiAssistant() {
  const { user } = useUser();
  const [config, setConfig] = useState<VapiConfig>({
    assistantId: FALLBACK_ASSISTANT_ID,
    toolId: null,
    apiKey: FALLBACK_API_KEY,
    isCustom: false,
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadConfig() {
      try {
        // Try to fetch from database first if user is logged in
        if (user?.id) {
          console.log('🔍 Fetching VAPI credentials from database for user:', user.id);
          const dbCredentials = await getUserVapiCredentials(user.id);

          if (dbCredentials?.webToken && dbCredentials?.assistantId) {
            console.log('✅ Found VAPI credentials in database');
            setConfig({
              assistantId: dbCredentials.assistantId,
              toolId: dbCredentials.toolId,
              apiKey: dbCredentials.webToken,
              isCustom: true,
            });

            // Also update localStorage for offline access
            localStorage.setItem('vapi_assistant_id', dbCredentials.assistantId);
            localStorage.setItem('vapi_tool_id', dbCredentials.toolId || '');
            localStorage.setItem('vapi_web_token', dbCredentials.webToken);
            localStorage.setItem('vapi_user_id', user.id);

            setIsLoading(false);
            return;
          }
          console.log('ℹ️ No credentials found in database, checking localStorage...');
        }

        // Fallback to localStorage
        const customAssistantId = localStorage.getItem('vapi_assistant_id');
        const customToolId = localStorage.getItem('vapi_tool_id');
        const customWebToken = localStorage.getItem('vapi_web_token');

        if (customAssistantId && customWebToken) {
          console.log('✅ Using VAPI credentials from localStorage');
          setConfig({
            assistantId: customAssistantId,
            toolId: customToolId,
            apiKey: customWebToken,
            isCustom: true,
          });
        } else {
          console.log('ℹ️ Using default VAPI credentials');
          setConfig({
            assistantId: FALLBACK_ASSISTANT_ID,
            toolId: null,
            apiKey: FALLBACK_API_KEY,
            isCustom: false,
          });
        }
      } catch (error) {
        console.error('❌ Error loading VAPI config:', error);
        // Fallback to default
        setConfig({
          assistantId: FALLBACK_ASSISTANT_ID,
          toolId: null,
          apiKey: FALLBACK_API_KEY,
          isCustom: false,
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadConfig();
  }, [user?.id]);

  const clearCustomConfig = async () => {
    // Clear localStorage
    localStorage.removeItem('vapi_assistant_id');
    localStorage.removeItem('vapi_tool_id');
    localStorage.removeItem('vapi_web_token');
    localStorage.removeItem('vapi_user_id');

    // Clear from database if user is logged in
    if (user?.id) {
      try {
        const { deleteUserVapiCredentials } = await import('@/lib/actions/vapi.action');
        await deleteUserVapiCredentials(user.id);
        console.log('✅ VAPI credentials cleared from database');
      } catch (error) {
        console.error('❌ Error clearing credentials from database:', error);
      }
    }

    // Reset to default config
    setConfig({
      assistantId: FALLBACK_ASSISTANT_ID,
      toolId: null,
      apiKey: FALLBACK_API_KEY,
      isCustom: false,
    });
  };

  return {
    ...config,
    isLoading,
    clearCustomConfig,
  };
}
