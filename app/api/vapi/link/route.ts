/**
 * app/api/vapi/link/route.ts
 *
 * Endpoint to link and validate a user's Vapi API key.
 * Validates the key by calling Vapi API, then stores it encrypted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { VapiClient } from '@/lib/vapi/client';
import { encrypt } from '@/lib/crypto';
import { saveApiKey } from '@/lib/db';
import { logger } from '@/lib/logger';

interface LinkRequest {
  userId: string;
  apiKey: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LinkRequest = await request.json();
    const { userId, apiKey } = body;

    // Validate input
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid userId', code: 'INVALID_USER_ID' },
        { status: 400 }
      );
    }

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return NextResponse.json(
        { error: 'Missing or invalid API key', code: 'INVALID_API_KEY' },
        { status: 400 }
      );
    }

    logger.info(`[Link] Validating API key for user: ${userId}`);

    // Validate the API key by calling Vapi API
    const vapiClient = new VapiClient(apiKey);

    try {
      // Test the API key by fetching assistants
      const assistants = await vapiClient.listAssistants();
      logger.info(`[Link] API key validated successfully. Found ${assistants.length} assistants.`);
    } catch (error: any) {
      logger.error(`[Link] API key validation failed:`, error);

      if (error.status === 401 || error.status === 403) {
        return NextResponse.json(
          {
            error: 'Invalid API key or insufficient permissions',
            code: 'UNAUTHORIZED',
            details: error.message
          },
          { status: 401 }
        );
      }

      throw error; // Re-throw for general error handler
    }

    // Encrypt and store the API key
    const encryptedKey = encrypt(apiKey);
    await saveApiKey(userId, encryptedKey);

    logger.info(`[Link] API key stored successfully for user: ${userId}`);

    return NextResponse.json({
      ok: true,
      message: 'API key validated and stored successfully'
    });

  } catch (error: any) {
    logger.error(`[Link] Unexpected error:`, error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
